type Language = "russian" | "english" | "other";

const LANGUAGE_NAMES: Record<Language, string> = {
  russian: "Russian",
  english: "English",
  other: "the same language as the source text",
};

const EMPTY_VALUE: Record<Language, string> = {
  russian: "Информация в тексте отсутствует",
  english: "Not described in the text",
  other: "Информация в тексте отсутствует",
};

// =============================================================================
// Проход 1: анализ фрагмента
// =============================================================================

export interface KnownCharacter {
  name: string;
  aliases: string[];
}

function knownCharactersSection(known: KnownCharacter[]): string {
  if (known.length === 0) return "";
  const list = known
    .map((k) =>
      k.aliases.length > 0 ? `${k.name} (${k.aliases.join(", ")})` : k.name,
    )
    .join("; ");
  return `
═══════════════════════════════════════════════════════════════
CHARACTERS ALREADY KNOWN FROM PREVIOUS FRAGMENTS
═══════════════════════════════════════════════════════════════
${list}

If a character from this list appears in the fragment below, use EXACTLY the same
"name" as in the list (put any new nickname or title into "aliases").
Do NOT include a listed character unless they actually appear in this fragment.
`;
}

/** Ожидаемая плотность событий: примерно одно на сцену. */
function expectedEventRange(textLength: number): [number, number] {
  const min = Math.max(3, Math.round(textLength / 12_000));
  const max = Math.max(min + 2, Math.round(textLength / 5_000));
  return [min, max];
}

export function chunkAnalysisPrompt(
  chunkIndex: number,
  totalChunks: number,
  text: string,
  language: Language = "other",
  knownCharacters: KnownCharacter[] = [],
): string {
  const langName = LANGUAGE_NAMES[language];
  const [minEvents, maxEvents] = expectedEventRange(text.length);
  const overlapNote =
    chunkIndex > 0
      ? "The first few paragraphs may repeat the end of the previous fragment; that is expected.\n"
      : "";

  return `You are a literary analyst extracting facts from a book fragment.
This is fragment ${chunkIndex + 1} of ${totalChunks}.
${overlapNote}${knownCharactersSection(knownCharacters)}
═══════════════════════════════════════════════════════════════
ABSOLUTE RULES — VIOLATING ANY OF THESE IS A SEVERE ERROR
═══════════════════════════════════════════════════════════════

RULE 1 — REAL CHARACTERS ONLY
Extract a character ONLY if their name (or alias) literally appears in the text below.
NEVER add characters from your general knowledge of the book/series.
NEVER add characters that are merely "implied" or "referenced" without being named.
If a character is not in the text — DO NOT include them.

RULE 2 — CLEAN, CONSISTENT NAMES
"name" MUST be a single proper name exactly as written in the text: same language,
same script, same spelling. Never translate or transliterate names.
Use the MOST COMPLETE form that appears in this fragment (e.g. first name + surname,
or name + patronymic). Put every shorter form, nickname, diminutive or title-with-name
that appears in the text into "aliases" — this is how fragments are matched later.
"aliases" must be NAMES. Never put generic descriptors there: not "knight",
"princess", "the beast", "host", "daughter", "your majesty", "old man". A title counts
only together with a name ("Lord Urcheon", "Queen Calanthe", "княжна Паветта").
FORBIDDEN name patterns:
  ✗ "Geralt/Narrator", "Geralt (implied)", "Geralt/Speaker"
  ✗ "The Host (Unnamed)", "The Companion (Implied)"
  ✗ "The Narrator", "The Protagonist", "The main character"
  ✗ "Local People", "Villagers/Bystanders", "The crowd", "General Characters"
  ✗ "Stregobor (Stregobor)" — double name in parens
ALLOWED examples:
  ✓ "Geralt of Rivia" with aliases ["Geralt", "witcher", "White Wolf"]
  ✓ "Йеннифэр из Венгерберга" with aliases ["Йеннифэр", "Йен"]
If a character has no name in the text, DO NOT extract them.

RULE 3 — LITERAL EXTRACTION FOR APPEARANCE & PERSONALITY
You MUST quote or closely paraphrase the actual text.
FORBIDDEN phrases (will be rejected):
  ✗ "Not explicitly described, but implied to be..."
  ✗ "Not detailed in this excerpt"
  ✗ "Implied to be powerful"
  ✗ "Unknown, but..."
  ✗ "N/A"
  ✗ "None"
If the text contains NO appearance details for a character — set "appearance" to an empty string "".
If the text contains NO personality details — set "personality" to "".
NEVER fill these fields with guesses, summaries, or inferences.

RULE 4 — APPEARANCE = SPECIFIC PHYSICAL FACTS FROM THE TEXT
Look for concrete words: hair color, eye color, height, build, scars, clothing items,
jewelry, weapons, age, voice description, etc.
Examples of GOOD appearance:
  ✓ "Чёрные локоны падают на плечи, фиолетовые глаза, бледная кожа, чёрно-белое платье, обсидиановая звезда на бархотке"
  ✓ "Tall, white-haired, golden cat-like eyes, two swords on his back"
Examples of BAD appearance (DO NOT WRITE LIKE THIS):
  ✗ "Powerful and intelligent"           — that's personality, not appearance
  ✗ "Implied to be a sorceress"          — implied = forbidden
  ✗ "Distinctive appearance"             — too vague
  ✗ "Well-kept and eloquent"             — not physical

RULE 5 — COMPLETENESS
Include EVERY named character, even one mentioned in a single line: a name in
dialogue, a messenger, a dead relative someone talks about. Minor characters are
filtered later; missing ones cannot be recovered.
Extract events at the density of roughly one per scene. For a fragment of this
length that means about ${minEvents}–${maxEvents} events, covering the fragment
from beginning to end. Do not stop early and do not compress the second half of
the fragment into one or two generic events.

RULE 6 — RESPOND IN ${langName.toUpperCase()}
All text values (appearance, personality, description, etc.) must be written in ${langName}.
If the source text is in Russian, your appearance/personality MUST contain Russian words
that come from the source text. Do not translate to English.

═══════════════════════════════════════════════════════════════
WHAT TO EXTRACT
═══════════════════════════════════════════════════════════════

For EACH named character in the fragment, return an object with fields:
  - name:        the character's most complete name in this fragment (per Rule 2)
  - aliases:     other NAMES for the same person (short forms, nicknames, title + name)
                 ONLY if they appear in the text; no generic descriptors
  - appearance:  literal physical details from text, or "" if none (per Rules 3, 4)
  - personality: literal behavioral details from text, or "" if none (per Rule 3)
  - description: who they are in this fragment: occupation, relations to other named
                 characters, what they do and want here (1-3 sentences from text)
  - significance: how important they are in this fragment: "central", "supporting" or "mentioned"

Also extract key plot events, in the order they occur in the fragment:
  - summary: 1-2 sentences about what happened: who did what to whom, where, with what outcome
  - charactersInvolved: names of NAMED participants (same name format as above)

═══════════════════════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════════════════════

INPUT TEXT (example):
  "Йеннифэр стояла у окна. Чёрные локоны тяжёлыми прядями ниспадали ей на плечи,
   фиолетовые глаза смотрели холодно. На шее — чёрная бархотка с обсидиановой звездой.
   Она поморщилась и резко повернулась к Геральту."

GOOD OUTPUT:
  {
    "name": "Йеннифэр",
    "aliases": [],
    "appearance": "Чёрные локоны тяжёлыми прядями ниспадают на плечи, фиолетовые глаза, на шее чёрная бархотка с обсидиановой звездой",
    "personality": "Холодный взгляд, резкие движения, поморщилась при разговоре",
    "description": "Стоит у окна, общается с Геральтом",
    "significance": "central"
  }

BAD OUTPUT (DO NOT DO THIS):
  {
    "name": "Yennefer (Sorceress)",                              ← Rule 2 violated: translated + parens
    "appearance": "Not explicitly described, but implied to be a powerful sorceress.", ← Rule 3
    "personality": "Powerful, commanding, emotionally complex"   ← Rule 3 (generic)
  }

═══════════════════════════════════════════════════════════════
TEXT FRAGMENT
═══════════════════════════════════════════════════════════════

${text}

═══════════════════════════════════════════════════════════════

Return JSON with EXACTLY this structure (no other keys allowed):
{
  "characters": [
    {
      "name": "...",
      "aliases": ["..."],
      "appearance": "...",
      "personality": "...",
      "description": "...",
      "significance": "..."
    }
  ],
  "events": [
    {
      "summary": "...",
      "charactersInvolved": ["..."]
    }
  ]
}
Remember: empty string "" is REQUIRED if a field has no data in the text.
NEVER write "implied", "not detailed", "unknown", "n/a", or "none" anywhere.`;
}

// =============================================================================
// Проход 1.5: сопоставление алиасов между фрагментами
// =============================================================================

export interface AliasCandidate {
  name: string;
  aliases: string[];
  mentionCount: number;
  sample: string;
}

export function aliasResolutionPrompt(
  candidates: AliasCandidate[],
  language: Language = "other",
): string {
  const langName = LANGUAGE_NAMES[language];

  return `You are a literary analyst. Below is a list of character records extracted
independently from different fragments of ONE book. Because fragments were processed
separately, the same person may appear several times under different names:
full name vs. first name, patronymic, nickname, title, transliteration variants,
diminutives (e.g. "Пётр Иванович" / "Петя" / "поручик Иванов",
"Geralt of Rivia" / "Geralt" / "the witcher" / "White Wolf").

Your task: group records that refer to the SAME person.

RULES
1. Decide ONLY from the evidence in the records: names, aliases, mention counts and
   the "sample" description. Do not use outside knowledge of the book.
2. Be conservative: merge two records only if you are confident they are one person.
   Relatives sharing a surname are DIFFERENT people unless the evidence says otherwise.
   Two people sharing only a title or profession ("captain", "priest") are DIFFERENT.
3. Strong evidence for merging: one record's name appears in another's aliases;
   samples describe the same occupation, relations or scene.
4. Every input name must appear in exactly one group. Records that match nobody form a
   group of one.
5. "canonicalName" must be one of the group's member names — pick the most complete
   form (full name over nickname), and among equally complete forms the most
   frequently mentioned. Write it in ${langName} exactly as it appears in the input.
6. Do not invent names that are not in the input.
7. For every group with more than one member give "confidence":
   - "high":   one name is literally listed among the other's aliases, or the samples
               describe the same person unambiguously (same occupation + same relation
               or same scene). Only "high" groups will be merged.
   - "medium": plausible but not proven (similar names, compatible samples).
   - "low":    a guess.
   and "evidence": one sentence quoting the facts you relied on.
   Two people who act in the same scene together (e.g. talk to each other) are never
   the same person.

INPUT
${JSON.stringify(candidates, null, 2)}

Return ONLY a JSON object, no prose, no markdown:
{ "groups": [ { "canonicalName": "...", "members": ["...", "..."], "confidence": "high", "evidence": "..." } ] }
Groups of one member may omit "confidence" and "evidence".`;
}

// =============================================================================
// Проход 2: классификация и сюжет
// =============================================================================

export interface CharacterContext {
  name: string;
  aliases: string[];
  /** Сколько раз персонаж встретился во фрагментах прохода 1. */
  mentionCount: number;
  descriptions: string[];
  /** Сколько описаний не вошло в промпт из-за ограничения размера. */
  descriptionsOmitted: number;
  /** Индексы событий из общей хронологии (timeline), где участвует персонаж. */
  eventIndices: number[];
}

export function classifyPrompt(
  characters: CharacterContext[],
  timeline: string[],
  language: Language = "other",
): string {
  const langName = LANGUAGE_NAMES[language];
  const emptyValue = EMPTY_VALUE[language];

  const charactersJson = characters.map((c) => ({
    name: c.name,
    aliases: c.aliases,
    mentionCount: c.mentionCount,
    eventCount: c.eventIndices.length,
    eventIndices: c.eventIndices,
    descriptionFragments: c.descriptions,
    ...(c.descriptionsOmitted > 0
      ? { descriptionFragmentsOmitted: c.descriptionsOmitted }
      : {}),
  }));

  const timelineText = timeline.map((e, i) => `[${i}] ${e}`).join("\n");

  return `You are a literary analyst.
You are given (A) the chronological list of plot events extracted from a book and
(B) the list of REAL characters extracted from the same book, each with description
fragments and the indices of events they take part in.
Your tasks: classify the characters by importance, describe each character's role,
and write a plot summary.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULES
═══════════════════════════════════════════════════════════════

RULE 1 — NO INVENTION
Use ONLY the data provided below. NEVER use your training knowledge of the book or
its characters, even if you recognize them.
If a character has no fragments and no events → put them in "minor" with
description "${emptyValue}".

RULE 2 — DO NOT ADD CHARACTERS
Use EXACTLY the names from the input list. Do not add new characters.
Do not split or merge characters, even if two entries look like the same person.

RULE 3 — IMPORTANCE BY ACTIVITY ACROSS THE WHOLE BOOK
Judge by eventCount, mentionCount and the spread of eventIndices across the timeline:
  - main:      the plot revolves around them; they act in events throughout the book.
               Typically 1-5 characters.
  - secondary: recurring characters with their own role in the plot: allies, antagonists,
               relatives, employers. Typically 5-15 characters.
  - minor:     appear in one scene or a couple of events, or are only mentioned.
A high mentionCount with few events usually means "secondary", not "main".

RULE 4 — RESPOND IN ${langName.toUpperCase()}
All text values must be in ${langName}. Keep character names exactly as in the input.

═══════════════════════════════════════════════════════════════
(A) TIMELINE — events in book order
═══════════════════════════════════════════════════════════════

${timelineText}

═══════════════════════════════════════════════════════════════
(B) CHARACTERS
═══════════════════════════════════════════════════════════════

${JSON.stringify(charactersJson, null, 2)}

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return a JSON object with the keys IN THIS ORDER:
  - title:    the book's title ONLY if it is evident from the data; otherwise "Unknown"
  - plotSummary:
      {
        "overview":  3-5 paragraphs retelling the TIMELINE as a coherent narrative in
                     book order: setup, main conflicts, turning points, resolution.
                     Cover the whole book, not just the beginning,
        "keyEvents": 10-25 key events from the timeline in chronological order
                     (each 1-2 sentences), including the ending
      }
  - main:     array of character names (from input only)
  - secondary: array of character names (from input only)
  - minor:    array of character names (from input only)
  - characterDetails: array of objects for MAIN and SECONDARY characters ONLY
      (minor characters are described automatically from their fragments):
      {
        "name":        (name from input),
        "description": 2-4 sentences synthesized FROM descriptionFragments and the
                       character's events: who they are, what they want, what they do
                       over the course of the book and how it ends for them,
        "role":        1-2 sentences about their function in the plot
                       (protagonist, mentor, antagonist, love interest, comic relief, ...)
      }

Every name in main and secondary MUST appear in characterDetails; do not add entries
for minor characters. Every characterDetails entry MUST have a name from the input list.
Every input name MUST appear in exactly one of main/secondary/minor.`;
}

// =============================================================================
// Проход 2.5: саммаризация персонажа
// =============================================================================

export function summarizeCharacterPrompt(
  name: string,
  appearanceFragments: string[],
  personalityFragments: string[],
  descriptionFragments: string[],
  language: Language = "other",
): string {
  const langName = LANGUAGE_NAMES[language];
  const emptyValue = EMPTY_VALUE[language];

  return `You are given raw extracted fragments about the character "${name}", collected
from different parts of a book in book order. Combine them into ONE appearance
description, ONE personality description and ONE description of the character.

═══════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════

1. PRESERVE EVERY SPECIFIC DETAIL from the fragments: colors, scars, clothes, habits,
   speech patterns, relations, deeds. Merge duplicates, but never drop a detail that
   appears only once.
2. DO NOT INVENT details that aren't in the fragments.
3. DO NOT use your training knowledge of the character, even if you recognize the book.
4. SKIP fragments that say only "implied", "not described", "unknown", "n/a" — they have
   no useful data. But KEEP any specific detail even if it's surrounded by such phrases.
5. If fragments contradict each other (the character changes clothes, ages, is wounded,
   changes sides), present it as a change over the course of the book, not as a
   contradiction.
6. STYLE: write in ${langName}, third person, present tense, as an encyclopedia entry
   about the character. Do not mention "fragments", "the text", "the excerpt" or
   "the author"; state the facts directly.
   - appearance:  2-5 sentences, physical facts only
   - personality: 3-6 sentences on temperament, values, habits, manner of speech,
                  attitude to others
   - description: 1-3 paragraphs: who they are, their background and relations, what
                  they want, what they do over the course of the book and how it ends
                  for them
7. If, after skipping useless fragments, NOTHING specific remains for a field —
   write exactly: "${emptyValue}". Do not pad with generic phrases.

═══════════════════════════════════════════════════════════════
APPEARANCE FRAGMENTS
═══════════════════════════════════════════════════════════════
${JSON.stringify(appearanceFragments, null, 2)}

═══════════════════════════════════════════════════════════════
PERSONALITY FRAGMENTS
═══════════════════════════════════════════════════════════════
${JSON.stringify(personalityFragments, null, 2)}

═══════════════════════════════════════════════════════════════
DESCRIPTION FRAGMENTS
═══════════════════════════════════════════════════════════════
${JSON.stringify(descriptionFragments, null, 2)}

═══════════════════════════════════════════════════════════════

Return JSON with exactly 3 string fields: "appearance", "personality", "description".`;
}

// =============================================================================
// Метаданные книги
// =============================================================================

export function bookMetadataPrompt(
  firstChunkText: string,
  language: Language = "other",
): string {
  const langName = LANGUAGE_NAMES[language];

  return `You are a literary analyst. Extract the book title and author(s) from the
following text (the first pages of a book).

Look for: title page, cover text, running headers/footers, author attribution lines,
copyright page, table of contents heading.

RULES
- Return ONLY what you find in the text. If title or authors are not present, return
  empty strings. Do not guess from your knowledge of literature.
- title: the title of THIS book in ${langName}, exactly as printed (keep original
  spelling and capitalization). If both a series title and a book title are present,
  return the book title. Do not include subtitle markers like "a novel".
- authors: the author(s) of the book, comma-separated if several. Ignore translators,
  editors, illustrators and publishers.

Text:
${firstChunkText}

Return ONLY a JSON object with exactly two string fields, no prose, no markdown:
{ "title": "...", "authors": "..." }`;
}
