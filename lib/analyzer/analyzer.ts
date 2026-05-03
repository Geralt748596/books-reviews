import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import ora from "ora";
import { llmStructuredRequest } from "./llm-client";
import {
  chunkAnalysisPrompt,
  classifyPrompt,
  summarizeCharacterPrompt,
  type CharacterContext,
} from "./prompts";
import {
  ChunkAnalysisSchema,
  ClassificationSchema,
  CharacterSummarySchema,
} from "./schemas";
import type {
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
} from "./text-chunker";

export interface AnalyzeParams {
  text: string;
  model: string;
  outputPath: string;
}

export async function analyzeBook(
  params: AnalyzeParams,
): Promise<BookAnalysis> {
  const { text, model, outputPath } = params;
  const debugDir = dirname(resolve(outputPath));

  const language = detectLanguage(text);
  const totalTokens = estimateTokens(text);
  console.log(
    `\nТекст книги: ~${totalTokens.toLocaleString()} токенов, ${text.length.toLocaleString()} символов, язык: ${language}`,
  );

  const chunks = splitIntoChunks(text);
  console.log(`Разбито на ${chunks.length} фрагмент(ов)\n`);

  // --- Проход 1: анализ каждого чанка ---
  const allCharacters: ChunkCharacter[] = [];
  const allEvents: ChunkEvent[] = [];

  for (const chunk of chunks) {
    const spinner = ora(
      `Проход 1: анализ фрагмента ${chunk.index + 1}/${chunks.length} (~${chunk.estimatedTokens.toLocaleString()} токенов)`,
    ).start();

    try {
      const prompt = chunkAnalysisPrompt(
        chunk.index,
        chunks.length,
        chunk.text,
        language,
      );
      const result = await llmStructuredRequest<ChunkAnalysis>({
        model,
        prompt,
        schema: ChunkAnalysisSchema,
      });

      const cleanedCharacters = result.characters
        .map(normalizeChunkCharacter)
        .filter(isRealCharacter);

      allCharacters.push(...cleanedCharacters);
      allEvents.push(...result.events);

      spinner.succeed(
        `Фрагмент ${chunk.index + 1}/${chunks.length}: ` +
          `${cleanedCharacters.length}/${result.characters.length} персонаж(ей), ${result.events.length} событий`,
      );
    } catch (error) {
      spinner.fail(`Фрагмент ${chunk.index + 1}/${chunks.length}: ошибка`);
      throw error;
    }
  }

  console.log(
    `\nПроход 1 завершён: ${allCharacters.length} упоминаний персонажей, ${allEvents.length} событий`,
  );

  await writeFile(
    resolve(debugDir, "intermediate-pass1.json"),
    JSON.stringify({ characters: allCharacters, events: allEvents }, null, 2),
    "utf-8",
  );

  // --- Программное объединение персонажей ---
  const merged = mergeCharacters(allCharacters);
  console.log(`  Объединено в ${merged.length} уникальных персонажей\n`);

  await writeFile(
    resolve(debugDir, "intermediate-merged.json"),
    JSON.stringify(merged, null, 2),
    "utf-8",
  );

  // --- Проход 2: классификация и сюжет ---
  const classifySpinner = ora(
    "Проход 2: классификация персонажей и генерация сюжета...",
  ).start();

  let classification: Classification;
  try {
    const characterContexts = buildCharacterContexts(merged, allEvents);
    const prompt = classifyPrompt(characterContexts, language);

    const promptTokens = estimateTokens(prompt);
    console.log(
      `  Данные для прохода 2: ~${promptTokens.toLocaleString()} токенов`,
    );

    classification = await llmStructuredRequest<Classification>({
      model,
      prompt,
      schema: ClassificationSchema,
    });

    const totalChars =
      classification.main.length +
      classification.secondary.length +
      classification.minor.length;

    classifySpinner.succeed(
      `Классификация: ${totalChars} персонаж(ей) ` +
        `(${classification.main.length} главных, ` +
        `${classification.secondary.length} второстепенных, ` +
        `${classification.minor.length} эпизодических)`,
    );
  } catch (error) {
    classifySpinner.fail("Проход 2: ошибка");
    throw error;
  }

  // --- Проход 2.5: LLM-саммаризация для важных персонажей ---
  const importantNames = new Set([
    ...classification.main.map((n) => n.toLowerCase()),
    ...classification.secondary.map((n) => n.toLowerCase()),
  ]);

  const summaries = new Map<string, CharacterSummary>();
  const charsToSummarize = merged.filter((m) =>
    importantNames.has(m.name.toLowerCase()),
  );
  console.log(
    `\nПроход 2.5: саммаризация ${charsToSummarize.length} важных персонажей`,
  );

  for (let i = 0; i < charsToSummarize.length; i++) {
    const m = charsToSummarize[i];
    const spinner = ora(
      `  Саммаризация ${i + 1}/${charsToSummarize.length}: ${m.name}`,
    ).start();

    const rawAppearances = m.appearanceFragments;
    const rawPersonalities = m.personalityFragments;
    const rawDescriptions = m.descriptionFragments;

    if (
      rawAppearances.length === 0 &&
      rawPersonalities.length === 0 &&
      rawDescriptions.length === 0
    ) {
      spinner.info(`  ${m.name}: нет данных для саммаризации`);
      continue;
    }

    try {
      const prompt = summarizeCharacterPrompt(
        m.name,
        rawAppearances,
        rawPersonalities,
        rawDescriptions,
        language,
      );
      const summary = await llmStructuredRequest<CharacterSummary>({
        model,
        prompt,
        schema: CharacterSummarySchema,
      });

      const cleaned: CharacterSummary = {
        appearance: cleanSummaryText(summary.appearance, language),
        personality: cleanSummaryText(summary.personality, language),
        description: cleanSummaryText(summary.description, language),
      };

      summaries.set(m.name.toLowerCase(), cleaned);
      spinner.succeed(`  ${m.name}: готово`);
    } catch (error) {
      spinner.fail(`  ${m.name}: ошибка саммаризации`);
    }
  }

  const result = assembleResult(classification, merged, summaries, language);

  const totalChars =
    result.characters.main.length +
    result.characters.secondary.length +
    result.characters.minor.length;

  console.log(
    `\nИтого: ${totalChars} персонаж(ей), ${result.plotSummary.keyEvents.length} событий`,
  );

  return result;
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

interface MergedCharacter {
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
  appearanceFragments: string[];
  personalityFragments: string[];
  descriptionFragments: string[];
  mentionCount: number;
}

function mergeCharacters(characters: ChunkCharacter[]): MergedCharacter[] {
  const accumulators: CharacterAccumulator[] = [];

  function findAccumulator(
    name: string,
    aliases: string[],
  ): CharacterAccumulator | undefined {
    const nameLower = name.toLowerCase();
    const aliasesLower = aliases.map((a) => a.toLowerCase());

    return accumulators.find((acc) => {
      if (acc.name.toLowerCase() === nameLower) return true;
      if (acc.aliases.has(nameLower)) return true;
      for (const alias of aliasesLower) {
        if (acc.name.toLowerCase() === alias) return true;
        if (acc.aliases.has(alias)) return true;
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
        appearanceFragments: [],
        personalityFragments: [],
        descriptionFragments: [],
        mentionCount: 0,
      };
      accumulators.push(acc);
    }

    char.aliases.forEach((a) => {
      const lower = a.toLowerCase();
      if (lower !== acc!.name.toLowerCase()) acc!.aliases.add(a);
    });

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

function cleanSummaryText(
  text: string,
  language: "russian" | "english" | "other",
): string {
  if (!text) return fallbackEmpty(language);
  const stripped = stripJunkSentences(text).trim();
  if (stripped.length < 10) return fallbackEmpty(language);
  return stripped;
}

function fallbackEmpty(language: "russian" | "english" | "other"): string {
  return language === "english"
    ? "Not described in the text"
    : "Информация в тексте отсутствует";
}

// =============================================================================
// Подготовка контекста для Pass 2 (classify)
// =============================================================================

function buildCharacterContexts(
  merged: MergedCharacter[],
  allEvents: ChunkEvent[],
): CharacterContext[] {
  return merged.map((m) => {
    const aliasSet = new Set([
      m.name.toLowerCase(),
      ...m.aliases.map((a) => a.toLowerCase()),
    ]);
    const events = allEvents
      .filter((ev) =>
        ev.charactersInvolved.some((p) => aliasSet.has(p.toLowerCase())),
      )
      .map((ev) => ev.summary);

    return {
      name: m.name,
      aliases: m.aliases,
      descriptions: m.descriptionFragments,
      events,
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
  language: "russian" | "english" | "other",
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
    const description = s?.description ?? d?.description ?? "";

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
    title: classification.title,
    characters: {
      main: classification.main.map(buildCharacter),
      secondary: classification.secondary.map(buildCharacter),
      minor: classification.minor.map(buildCharacter),
    },
    plotSummary: classification.plotSummary,
  };
}
