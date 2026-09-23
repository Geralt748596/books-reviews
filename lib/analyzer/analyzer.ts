import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createExecutor, type Executor } from "./executor";
import { getChunkOptionsForModel, getConcurrencyForModel } from "./llm-client";
import { looksLikeProperName } from "./names";
import { phase, print, warn } from "./run-context";
import {
  aliasResolutionPrompt,
  bookMetadataPrompt,
  chunkAnalysisPrompt,
  classifyPrompt,
  summarizeCharacterPrompt,
  type AliasCandidate,
  type CharacterContext,
  type KnownCharacter,
} from "./prompts";
import {
  AliasResolutionSchema,
  BookMetadataSchema,
  ChunkAnalysisSchema,
  ClassificationSchema,
  CharacterSummarySchema,
} from "./schemas";
import type {
  AliasResolution,
  ChunkAnalysis,
  ChunkCharacter,
  ChunkEvent,
  BookAnalysis,
  Classification,
  Character,
  CharacterSummary,
} from "./types";
import {
  splitIntoChunks,
  estimateTokens,
  detectLanguage,
  type TextChunk,
} from "./text-chunker";

type Language = "russian" | "english" | "other";

export interface AnalyzeParams {
  text: string;
  model: string;
  outputPath: string;
  title?: string;
  /** Отправлять запросы через Claude Message Batches API (скидка 50%). */
  batch?: boolean;
  /** Игнорировать промежуточные результаты предыдущего запуска. */
  fresh?: boolean;
  /** Переопределить размер фрагмента в токенах. */
  chunkTokens?: number;
}

/** Каталог с промежуточными результатами конкретной книги. */
export function workDirFor(outputPath: string): string {
  return resolve(outputPath).replace(/\.analysis\.json$/i, "") + ".work";
}

// Лимиты вывода по стадиям (токены)
const OUTPUT_LIMITS = {
  metadata: 1_024,
  chunk: 32_000,
  aliases: 16_000,
  classify: 32_000,
  summary: 8_000,
};

// Сколько известных персонажей передавать в промпт следующего фрагмента
const MAX_KNOWN_CHARACTERS = 150;

export async function analyzeBook(
  params: AnalyzeParams,
): Promise<BookAnalysis> {
  const { text, model, outputPath } = params;
  const workDir = workDirFor(outputPath);

  const language = detectLanguage(text);
  const totalTokens = estimateTokens(text);
  print(
    `\nТекст книги: ~${totalTokens.toLocaleString()} токенов, ${text.length.toLocaleString()} символов, язык: ${language}`,
  );

  const chunkOptions = params.chunkTokens
    ? {
        maxTokens: params.chunkTokens,
        overlapTokens: Math.round(params.chunkTokens * 0.1),
      }
    : getChunkOptionsForModel(model);

  const executor = createExecutor({
    model,
    variant: `chunk-${chunkOptions.maxTokens}`,
    workDir,
    fresh: params.fresh,
    batch: params.batch ?? false,
  });

  const chunks = splitIntoChunks(text, chunkOptions);
  print(
    `Разбито на ${chunks.length} фрагмент(ов) по ~${chunkOptions.maxTokens.toLocaleString()} токенов, режим: ${executor.mode}`,
  );
  print(`Промежуточные результаты: ${workDir}\n`);

  if (chunks.length === 0) {
    throw new Error("Из PDF не удалось извлечь текст");
  }

  // --- Проход 1: метаданные + анализ каждого фрагмента ---
  const pass1 = await runPass1(executor, chunks, language, params.title);

  const extractedTitle = params.title ?? pass1.title;
  const extractedAuthors = pass1.authors;
  const allCharacters = pass1.characters;
  const allEvents = pass1.events;

  print(
    `\nПроход 1 завершён: ${allCharacters.length} упоминаний персонажей, ${allEvents.length} событий`,
  );

  await writeFile(
    resolve(workDir, "intermediate-pass1.json"),
    JSON.stringify({ characters: allCharacters, events: allEvents }, null, 2),
    "utf-8",
  );

  // --- Объединение персонажей: строковая логика + LLM-сопоставление алиасов ---
  let merged = mergeCharacters(allCharacters, allEvents);
  print(`  Строковое объединение: ${merged.length} кандидатов в персонажи`);

  merged = await resolveAliases(executor, merged, allEvents, language);
  print(`  Итого уникальных персонажей: ${merged.length}\n`);

  await writeFile(
    resolve(workDir, "intermediate-merged.json"),
    JSON.stringify(merged, null, 2),
    "utf-8",
  );

  // --- Проход 2: классификация и сюжет ---
  const classification = await runClassify(
    executor,
    merged,
    allEvents,
    language,
  );

  // --- Проход 2.5: саммаризация важных персонажей ---
  const summaries = await runSummaries(
    executor,
    model,
    merged,
    classification,
    language,
  );

  const result = assembleResult(
    classification,
    merged,
    summaries,
    language,
    extractedTitle,
    extractedAuthors,
  );

  const totalChars =
    result.characters.main.length +
    result.characters.secondary.length +
    result.characters.minor.length;

  print(
    `\nИтого: ${totalChars} персонаж(ей), ${result.plotSummary.keyEvents.length} событий`,
  );

  return result;
}

// =============================================================================
// Проход 1
// =============================================================================

interface Pass1Result {
  title: string;
  authors: string;
  characters: ChunkCharacter[];
  events: ChunkEvent[];
}

const META_ID = "meta";
const chunkId = (index: number) => `chunk-${index}`;

async function runPass1(
  executor: Executor,
  chunks: TextChunk[],
  language: Language,
  knownTitle: string | undefined,
): Promise<Pass1Result> {
  const ids = [
    ...(knownTitle ? [] : [META_ID]),
    ...chunks.map((c) => chunkId(c.index)),
  ];

  phase(`Проход 1: ${chunks.length} фрагмент(ов)`);

  const outcome = await executor.run<unknown>("pass1", ids, (id, ctx) => {
    if (id === META_ID) {
      return {
        id,
        prompt: bookMetadataPrompt(chunks[0].text.slice(0, 60_000), language),
        schema: BookMetadataSchema,
        reasoning: false,
        maxOutputTokens: OUTPUT_LIMITS.metadata,
        label: "Извлечение названия и авторов из первого фрагмента",
      };
    }

    const index = Number(id.slice("chunk-".length));
    const chunk = chunks[index];

    // В последовательном режиме модель получает список уже найденных персонажей
    // и использует те же имена. В batch-режиме ctx.previous пуст, а алиасы
    // сводятся отдельной фазой после прохода 1.
    const known = collectKnownCharacters(ctx.previous, index);

    return {
      id,
      prompt: chunkAnalysisPrompt(
        chunk.index,
        chunks.length,
        chunk.text,
        language,
        known,
      ),
      schema: ChunkAnalysisSchema,
      reasoning: false,
      maxOutputTokens: OUTPUT_LIMITS.chunk,
      label: `Фрагмент ${chunk.index + 1}/${chunks.length} (~${chunk.estimatedTokens.toLocaleString()} токенов${known.length ? `, известно ${known.length} перс.` : ""})`,
    };
  });

  // Ошибки фрагментов фатальны: без них анализ неполный
  const chunkErrors = Array.from(outcome.errors.entries()).filter(
    ([id]) => id !== META_ID,
  );
  if (chunkErrors.length > 0) {
    const [id, err] = chunkErrors[0];
    throw new Error(
      `Не удалось проанализировать ${chunkErrors.length} фрагмент(ов). ${id}: ${err.message}`,
    );
  }

  let title = "";
  let authors = "";
  if (!knownTitle) {
    const meta = outcome.results.get(META_ID) as
      { title: string; authors: string } | undefined;
    if (meta) {
      title = meta.title ?? "";
      authors = meta.authors ?? "";
      print(`  Метаданные: "${title}" by ${authors}`);
    } else {
      warn("Не удалось извлечь метаданные книги");
    }
  }

  const characters: ChunkCharacter[] = [];
  const events: ChunkEvent[] = [];

  for (const chunk of chunks) {
    const analysis = outcome.results.get(chunkId(chunk.index)) as ChunkAnalysis;
    const cleaned = analysis.characters
      .map(normalizeChunkCharacter)
      .filter(isRealCharacter);
    characters.push(...cleaned);
    events.push(...analysis.events);
  }

  return { title, authors, characters, events };
}

function collectKnownCharacters(
  previous: Map<string, unknown>,
  currentIndex: number,
): KnownCharacter[] {
  const seen: ChunkCharacter[] = [];
  for (let i = 0; i < currentIndex; i++) {
    const analysis = previous.get(chunkId(i)) as ChunkAnalysis | undefined;
    if (!analysis) continue;
    seen.push(
      ...analysis.characters
        .map(normalizeChunkCharacter)
        .filter(isRealCharacter),
    );
  }
  if (seen.length === 0) return [];

  return mergeCharacters(seen)
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, MAX_KNOWN_CHARACTERS)
    .map((m) => ({ name: m.name, aliases: m.aliases }));
}

// =============================================================================
// Проход 1.5: LLM-сопоставление алиасов
// =============================================================================

async function resolveAliases(
  executor: Executor,
  merged: MergedCharacter[],
  allEvents: ChunkEvent[],
  language: Language,
): Promise<MergedCharacter[]> {
  if (merged.length < 2) return merged;

  // Шум не сопоставить ни с чем: одно упоминание, ни одного фрагмента, ни одного события
  const inEvents = new Set(
    allEvents.flatMap((ev) =>
      ev.charactersInvolved.map((n) => n.trim().toLowerCase()),
    ),
  );
  const informative = merged.filter(
    (m) =>
      m.mentionCount > 1 ||
      m.descriptionFragments.length > 0 ||
      m.appearanceFragments.length > 0 ||
      m.personalityFragments.length > 0 ||
      inEvents.has(m.name.toLowerCase()),
  );
  if (informative.length < merged.length) {
    print(
      `  Кандидатов на сопоставление: ${informative.length} из ${merged.length} (остальные без данных)`,
    );
  }
  if (informative.length < 2) return merged;

  const candidates: AliasCandidate[] = informative.map((m) => ({
    name: m.name,
    aliases: m.aliases,
    mentionCount: m.mentionCount,
    sample: (m.descriptionFragments[0] ?? "").slice(0, 200),
  }));

  const outcome = await executor.run<AliasResolution>(
    "aliases",
    ["aliases"],
    (id) => ({
      id,
      prompt: aliasResolutionPrompt(candidates, language),
      schema: AliasResolutionSchema,
      // DeepSeek с reasoning обдумывает каждого из ~100 кандидатов и упирается в лимит
      // вывода; без рассуждений даёт те же слияния за секунды
      reasoning: false,
      maxOutputTokens: OUTPUT_LIMITS.aliases,
      label: `Сопоставление алиасов (${candidates.length} кандидатов)`,
    }),
  );

  const resolution = outcome.results.get("aliases");
  if (!resolution) {
    warn(
      "LLM-сопоставление алиасов не удалось, остаётся строковое объединение",
    );
    return merged;
  }

  const before = merged.length;
  const result = applyAliasGroups(merged, resolution.groups, allEvents);
  print(`  LLM-сопоставление алиасов: ${before} → ${result.length} персонажей`);
  return result;
}

/** Пары имён, которые вместе участвуют в одном событии — это разные люди. */
function buildCoOccurrence(allEvents: ChunkEvent[]): Set<string> {
  const pairs = new Set<string>();
  for (const ev of allEvents) {
    const names = Array.from(
      new Set(ev.charactersInvolved.map((n) => n.trim().toLowerCase())),
    );
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        pairs.add([names[i], names[j]].sort().join("\u0000"));
      }
    }
  }
  return pairs;
}

/**
 * Имена лексически связаны, если одно входит в алиасы другого или одно
 * содержится в другом («Geralt» ⊂ «Geralt of Rivia»). Такая пара может
 * встречаться в одном событии под двумя именами и всё равно быть одним человеком.
 */
function lexicallyLinked(a: MergedCharacter, b: MergedCharacter): boolean {
  const an = a.name.toLowerCase();
  const bn = b.name.toLowerCase();
  const aAliases = a.aliases.map((x) => x.toLowerCase());
  const bAliases = b.aliases.map((x) => x.toLowerCase());
  return (
    aAliases.includes(bn) ||
    bAliases.includes(an) ||
    an.split(/\s+/).includes(bn) ||
    bn.split(/\s+/).includes(an)
  );
}

export function applyAliasGroups(
  merged: MergedCharacter[],
  groups: AliasResolution["groups"],
  allEvents: ChunkEvent[],
): MergedCharacter[] {
  const byKey = new Map(merged.map((m) => [m.name.toLowerCase(), m]));
  const groupOf = new Map<string, MergedCharacter>();
  const coOccur = buildCoOccurrence(allEvents);

  for (const group of groups) {
    const memberKeys = Array.from(
      new Set(group.members.map((n) => n.trim().toLowerCase())),
    ).filter((k) => byKey.has(k) && !groupOf.has(k));
    if (memberKeys.length < 2) continue;

    if (group.confidence !== "high") {
      print(
        `  · пропуск группы [${memberKeys.join(" | ")}]: уверенность ${group.confidence}`,
      );
      continue;
    }

    // Защита от ложных слияний: участники одной сцены не могут быть одним человеком,
    // если только их имена не связаны лексически (один персонаж назван двумя именами)
    const conflict = memberKeys.find((a, i) =>
      memberKeys
        .slice(i + 1)
        .some(
          (b) =>
            coOccur.has([a, b].sort().join("\u0000")) &&
            !lexicallyLinked(byKey.get(a)!, byKey.get(b)!),
        ),
    );
    if (conflict) {
      print(
        `  · отклонена группа [${memberKeys.join(" | ")}]: имена встречаются вместе в одном событии`,
      );
      continue;
    }

    const canonicalKey = group.canonicalName.trim().toLowerCase();
    const baseKey = memberKeys.includes(canonicalKey)
      ? canonicalKey
      : memberKeys[0];
    const base = byKey.get(baseKey)!;

    const aliases = new Set(base.aliases);
    const appearanceFragments = [...base.appearanceFragments];
    const personalityFragments = [...base.personalityFragments];
    const descriptionFragments = [...base.descriptionFragments];
    let mentionCount = base.mentionCount;

    for (const key of memberKeys) {
      if (key === baseKey) continue;
      const other = byKey.get(key)!;
      aliases.add(other.name);
      other.aliases.forEach((a) => aliases.add(a));
      appearanceFragments.push(...other.appearanceFragments);
      personalityFragments.push(...other.personalityFragments);
      descriptionFragments.push(...other.descriptionFragments);
      mentionCount += other.mentionCount;
    }
    aliases.delete(base.name);

    const combined: MergedCharacter = {
      name: base.name,
      aliases: Array.from(aliases),
      appearance: joinFragments(appearanceFragments),
      personality: joinFragments(personalityFragments),
      appearanceFragments,
      personalityFragments,
      descriptionFragments,
      mentionCount,
    };
    for (const key of memberKeys) groupOf.set(key, combined);
  }

  // Сохраняем исходный порядок: группа выводится на месте первого участника
  const emitted = new Set<MergedCharacter>();
  const result: MergedCharacter[] = [];
  for (const m of merged) {
    const target = groupOf.get(m.name.toLowerCase()) ?? m;
    if (emitted.has(target)) continue;
    emitted.add(target);
    result.push(target);
  }
  return result;
}

// =============================================================================
// Проход 2: классификация
// =============================================================================

async function runClassify(
  executor: Executor,
  merged: MergedCharacter[],
  allEvents: ChunkEvent[],
  language: Language,
): Promise<Classification> {
  const timeline = dedupeEvents(allEvents);
  const characterContexts = buildCharacterContexts(merged, timeline);
  const prompt = classifyPrompt(
    characterContexts,
    timeline.map((ev) => ev.summary),
    language,
  );
  phase(
    `Проход 2: классификация, ~${estimateTokens(prompt).toLocaleString()} токенов входа`,
  );

  const outcome = await executor.run<Classification>(
    "classify",
    ["classify"],
    (id) => ({
      id,
      prompt,
      schema: ClassificationSchema,
      reasoning: true,
      maxOutputTokens: OUTPUT_LIMITS.classify,
      label: "Классификация персонажей и генерация сюжета",
    }),
  );

  const classification = outcome.results.get("classify");
  if (!classification) {
    throw new Error(
      `Проход 2 не удался: ${outcome.errors.get("classify")?.message ?? "нет результата"}`,
    );
  }

  // Персонажи, которых модель не включила ни в один список, идут в minor,
  // иначе они молча пропадут из результата.
  const listed = new Set(
    [
      ...classification.main,
      ...classification.secondary,
      ...classification.minor,
    ].map((n) => n.toLowerCase()),
  );
  const dropped = merged.filter((m) => !listed.has(m.name.toLowerCase()));
  if (dropped.length > 0) {
    warn(
      `${dropped.length} персонаж(ей) не попали в классификацию, добавлены в minor: ${dropped
        .slice(0, 5)
        .map((m) => m.name)
        .join(", ")}${dropped.length > 5 ? "…" : ""}`,
    );
    classification.minor.push(...dropped.map((m) => m.name));
  }

  const total =
    classification.main.length +
    classification.secondary.length +
    classification.minor.length;
  print(
    `  Классификация: ${total} персонаж(ей) ` +
      `(${classification.main.length} главных, ` +
      `${classification.secondary.length} второстепенных, ` +
      `${classification.minor.length} эпизодических)\n`,
  );

  return classification;
}

// =============================================================================
// Проход 2.5: саммаризация
// =============================================================================

async function runSummaries(
  executor: Executor,
  model: string,
  merged: MergedCharacter[],
  classification: Classification,
  language: Language,
): Promise<Map<string, CharacterSummary>> {
  const importantNames = new Set([
    ...classification.main.map((n) => n.toLowerCase()),
    ...classification.secondary.map((n) => n.toLowerCase()),
  ]);

  const targets = merged
    .map((m, index) => ({ m, index }))
    .filter(
      ({ m }) =>
        importantNames.has(m.name.toLowerCase()) &&
        (m.appearanceFragments.length > 0 ||
          m.personalityFragments.length > 0 ||
          m.descriptionFragments.length > 0),
    );

  phase(`Проход 2.5: саммаризация ${targets.length} важных персонажей`);
  const summaries = new Map<string, CharacterSummary>();
  if (targets.length === 0) return summaries;

  const byId = new Map(targets.map((t) => [`summary-${t.index}`, t.m]));

  const outcome = await executor.run<CharacterSummary>(
    "summaries",
    Array.from(byId.keys()),
    (id) => {
      const m = byId.get(id)!;
      return {
        id,
        prompt: summarizeCharacterPrompt(
          m.name,
          m.appearanceFragments,
          m.personalityFragments,
          m.descriptionFragments,
          language,
        ),
        schema: CharacterSummarySchema,
        // объединение фрагментов без выдумок: рассуждения не нужны, а втрое дороже
        reasoning: false,
        maxOutputTokens: OUTPUT_LIMITS.summary,
        label: `Саммаризация: ${m.name}`,
      };
    },
    { concurrency: getConcurrencyForModel(model) },
  );

  for (const [id, summary] of outcome.results) {
    const m = byId.get(id)!;
    summaries.set(m.name.toLowerCase(), {
      appearance: cleanSummaryText(summary.appearance, language),
      personality: cleanSummaryText(summary.personality, language),
      description: cleanSummaryText(summary.description, language),
    });
  }

  if (outcome.errors.size > 0) {
    warn(
      `Не удалось саммаризировать ${outcome.errors.size} персонаж(ей), для них используются сырые фрагменты`,
    );
  }

  return summaries;
}

// =============================================================================
// Нормализация имён и фильтрация мусорных персонажей
// =============================================================================

const ROLE_NAME_PATTERNS = [
  /^the\s+(narrator|protagonist|host|companion|witch|crowd|villager|stranger|man|woman|girl|boy|gentleman|sorceress|sorcerer|witcher|antagonist)/i,
  /^(narrator|protagonist|host|companion|witch|crowd|villager|stranger|gentleman)$/i,
  /^(local|general|various|main|the\s+main)\s+/i,
  /^(implied|unnamed|unknown)/i,
  /\b(implied|unnamed|inferred)\b/i,
  /\b(populace|onlookers|inhabitants|bystanders)\b/i,
  /\b(authority\s+figure|main\s+character)\b/i,
  /^[A-Za-z]+\/[A-Za-z]+/, // "Geralt/Narrator"
];

function normalizeName(rawName: string): string | null {
  if (!rawName) return null;

  let name = rawName.trim();

  name = name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  name = name.split("/")[0].trim();
  name = name.replace(/\s+/g, " ");

  if (name.length < 2 || name.length > 60) return null;

  for (const pattern of ROLE_NAME_PATTERNS) {
    if (pattern.test(name)) return null;
  }

  if (/^[a-z]/.test(name) && !/^(de|von|van|of)\b/i.test(name)) {
    return null;
  }

  return name;
}

function normalizeChunkCharacter(c: ChunkCharacter): ChunkCharacter {
  const normalized = normalizeName(c.name);
  return {
    ...c,
    name: normalized ?? c.name,
    aliases: c.aliases
      .map((a) => a?.trim())
      .filter(
        (a) =>
          a &&
          a.length > 0 &&
          a.toLowerCase() !== "n/a" &&
          a.toLowerCase() !== "none",
      ),
  };
}

function isRealCharacter(c: ChunkCharacter): boolean {
  return normalizeName(c.name) !== null;
}

// =============================================================================
// Объединение персонажей с алиас-матчингом
// =============================================================================

export interface MergedCharacter {
  name: string;
  aliases: string[];
  appearance: string;
  personality: string;
  appearanceFragments: string[];
  personalityFragments: string[];
  descriptionFragments: string[];
  mentionCount: number;
}

interface CharacterAccumulator {
  name: string;
  aliases: Set<string>;
  /** Алиасы (в нижнем регистре), по которым можно сопоставлять записи. */
  matchAliases: Set<string>;
  appearanceFragments: string[];
  personalityFragments: string[];
  descriptionFragments: string[];
  mentionCount: number;
}

/**
 * Алиасы, по которым безопасно склеивать записи: похожи на имя собственное и
 * заявлены ровно одним персонажем. Спорные случаи оставляем LLM-фазе.
 */
function buildMatchableAliases(characters: ChunkCharacter[]): Set<string> {
  const claimants = new Map<string, Set<string>>();
  for (const c of characters) {
    for (const alias of c.aliases) {
      if (!looksLikeProperName(alias)) continue;
      const key = alias.trim().toLowerCase();
      if (key === c.name.toLowerCase()) continue;
      if (!claimants.has(key)) claimants.set(key, new Set());
      claimants.get(key)!.add(c.name.toLowerCase());
    }
  }
  const result = new Set<string>();
  for (const [alias, names] of claimants) {
    if (names.size === 1) result.add(alias);
  }
  return result;
}

function mergeCharacters(
  characters: ChunkCharacter[],
  allEvents: ChunkEvent[] = [],
): MergedCharacter[] {
  const accumulators: CharacterAccumulator[] = [];
  const matchable = buildMatchableAliases(characters);
  const coOccur = buildCoOccurrence(allEvents);
  const pairKey = (a: string, b: string) => [a, b].sort().join("\u0000");

  function findAccumulator(
    name: string,
    aliases: string[],
  ): CharacterAccumulator | undefined {
    const nameLower = name.toLowerCase();
    const aliasesLower = aliases
      .map((a) => a.trim().toLowerCase())
      .filter((a) => matchable.has(a));

    const exact = accumulators.find(
      (acc) => acc.name.toLowerCase() === nameLower,
    );
    if (exact) return exact;

    return accumulators.find((acc) => {
      const accName = acc.name.toLowerCase();
      // Участники одной сцены — разные люди
      if (coOccur.has(pairKey(accName, nameLower))) return false;

      if (acc.matchAliases.has(nameLower)) return true;
      for (const alias of aliasesLower) {
        if (accName === alias) return true;
        if (acc.matchAliases.has(alias)) return true;
      }
      return false;
    });
  }

  for (const char of characters) {
    let acc = findAccumulator(char.name, char.aliases);

    if (!acc) {
      acc = {
        name: char.name,
        aliases: new Set(),
        matchAliases: new Set(),
        appearanceFragments: [],
        personalityFragments: [],
        descriptionFragments: [],
        mentionCount: 0,
      };
      accumulators.push(acc);
    }

    char.aliases.forEach((a) => {
      const lower = a.trim().toLowerCase();
      if (lower === acc!.name.toLowerCase()) return;
      acc!.aliases.add(a);
      if (matchable.has(lower)) acc!.matchAliases.add(lower);
    });
    if (char.name.toLowerCase() !== acc.name.toLowerCase()) {
      acc.aliases.add(char.name);
      acc.matchAliases.add(char.name.toLowerCase());
    }

    if (isUsefulFragment(char.appearance)) {
      acc.appearanceFragments.push(char.appearance.trim());
    }
    if (isUsefulFragment(char.personality)) {
      acc.personalityFragments.push(char.personality.trim());
    }
    if (isUsefulFragment(char.description)) {
      acc.descriptionFragments.push(char.description.trim());
    }
    acc.mentionCount += 1;
  }

  return accumulators.map((acc) => ({
    name: acc.name,
    aliases: Array.from(acc.aliases),
    appearance: joinFragments(acc.appearanceFragments),
    personality: joinFragments(acc.personalityFragments),
    appearanceFragments: acc.appearanceFragments,
    personalityFragments: acc.personalityFragments,
    descriptionFragments: acc.descriptionFragments,
    mentionCount: acc.mentionCount,
  }));
}

// =============================================================================
// Фильтрация мусорных фраз
// =============================================================================

const JUNK_PATTERNS = [
  /not explicitly/i,
  /not described/i,
  /not detailed/i,
  /\bnot shown\b/i,
  /\bimplied to\b/i,
  /\bimplied:/i,
  /\bunknown\b/i,
  /\btypically depicted\b/i,
  /\bn\/a\b/i,
  /^none\.?$/i,
  /^\s*none\s*$/i,
  /^abstract\.?$/i,
  /general crowd/i,
  /general populace/i,
  /omniscient/i,
  /verbal and physical/i,
  /варьирует/i,
  /не описан/i,
  /не описано/i,
  /не упоминается/i,
  /не уточняется/i,
];

function isUsefulFragment(text: string | undefined | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  if (JUNK_PATTERNS.every((p) => !p.test(trimmed))) return true;

  const cleaned = stripJunkSentences(trimmed);
  return cleaned.length >= 10;
}

function stripJunkSentences(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => {
      const trimmed = sentence.trim();
      if (trimmed.length < 5) return false;
      return JUNK_PATTERNS.every((p) => !p.test(trimmed));
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function joinFragments(fragments: string[]): string {
  if (fragments.length === 0) return "";
  const cleaned = fragments
    .map(stripJunkSentences)
    .filter((f) => f.length >= 5);
  if (cleaned.length === 0) return "";
  const unique = Array.from(new Set(cleaned));
  return unique.join(" ");
}

function cleanSummaryText(text: string, language: Language): string {
  if (!text) return fallbackEmpty(language);
  const stripped = stripJunkSentences(text).trim();
  if (stripped.length < 10) return fallbackEmpty(language);
  return stripped;
}

function fallbackEmpty(language: Language): string {
  return language === "english"
    ? "Not described in the text"
    : "Информация в тексте отсутствует";
}

// =============================================================================
// Подготовка контекста для Pass 2 (classify)
// =============================================================================

// Сколько описаний одного персонажа передавать в промпт классификации
const MAX_DESCRIPTIONS_PER_CHARACTER = 15;

/** Убирает дословные дубли событий, возникающие из-за перекрытия фрагментов. */
function dedupeEvents(allEvents: ChunkEvent[]): ChunkEvent[] {
  const seen = new Set<string>();
  const result: ChunkEvent[] = [];
  for (const ev of allEvents) {
    const key = ev.summary.trim().toLowerCase().replace(/\s+/g, " ");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(ev);
  }
  return result;
}

function buildCharacterContexts(
  merged: MergedCharacter[],
  timeline: ChunkEvent[],
): CharacterContext[] {
  return merged.map((m) => {
    const aliasSet = new Set([
      m.name.toLowerCase(),
      ...m.aliases.map((a) => a.toLowerCase()),
    ]);
    const eventIndices: number[] = [];
    timeline.forEach((ev, index) => {
      if (ev.charactersInvolved.some((p) => aliasSet.has(p.toLowerCase()))) {
        eventIndices.push(index);
      }
    });

    const descriptions = m.descriptionFragments.slice(
      0,
      MAX_DESCRIPTIONS_PER_CHARACTER,
    );

    return {
      name: m.name,
      aliases: m.aliases,
      mentionCount: m.mentionCount,
      descriptions,
      descriptionsOmitted: m.descriptionFragments.length - descriptions.length,
      eventIndices,
    };
  });
}

// =============================================================================
// Сборка финального JSON
// =============================================================================

function assembleResult(
  classification: Classification,
  merged: MergedCharacter[],
  summaries: Map<string, CharacterSummary>,
  language: Language,
  extractedTitle: string,
  extractedAuthors: string,
): BookAnalysis {
  const charLookup = new Map<string, MergedCharacter>();
  for (const m of merged) {
    charLookup.set(m.name.toLowerCase(), m);
    for (const alias of m.aliases) {
      charLookup.set(alias.toLowerCase(), m);
    }
  }

  const detailLookup = new Map<string, { description: string; role: string }>();
  for (const cd of classification.characterDetails) {
    detailLookup.set(cd.name.toLowerCase(), {
      description: cd.description,
      role: cd.role,
    });
  }

  function buildCharacter(name: string): Character {
    const key = name.toLowerCase();
    const m = charLookup.get(key);
    const d = detailLookup.get(key);
    const s = m ? summaries.get(m.name.toLowerCase()) : undefined;

    const appearance =
      s?.appearance ?? (m?.appearance ? m.appearance : "") ?? "";
    const personality =
      s?.personality ?? (m?.personality ? m.personality : "") ?? "";
    const description =
      s?.description ||
      d?.description ||
      (m ? joinFragments(m.descriptionFragments) : "");

    return {
      name: m?.name ?? name,
      aliases: m?.aliases ?? [],
      appearance: appearance || fallbackEmpty(language),
      personality: personality || fallbackEmpty(language),
      description: description || fallbackEmpty(language),
      role: d?.role ?? fallbackEmpty(language),
    };
  }

  return {
    title: extractedTitle || classification.title,
    authors: extractedAuthors,
    language,
    characters: {
      main: classification.main.map(buildCharacter),
      secondary: classification.secondary.map(buildCharacter),
      minor: classification.minor.map(buildCharacter),
    },
    plotSummary: classification.plotSummary,
  };
}
