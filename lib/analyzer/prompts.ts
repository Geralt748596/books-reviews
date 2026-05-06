type Language = "russian" | "english" | "other";

const LANGUAGE_NAMES: Record<Language, string> = {
  russian: "Russian",
  english: "English",
  other: "the same language as the source text",
};

export function chunkAnalysisPrompt(
  chunkIndex: number,
  totalChunks: number,
  text: string,
  language: Language = "other",
): string {
  const langName = LANGUAGE_NAMES[language];

  return `You are a literary analyst extracting facts from a book fragment.
This is fragment ${chunkIndex + 1} of ${totalChunks}.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULES — VIOLATING ANY OF THESE IS A SEVERE ERROR
═══════════════════════════════════════════════════════════════

RULE 1 — REAL CHARACTERS ONLY
Extract a character ONLY if their name (or alias) literally appears in the text below.
NEVER add characters from your general knowledge of the book/series.
NEVER add characters that are merely "implied" or "referenced" without being named.
If a character is not in the text — DO NOT include them.

RULE 2 — CLEAN NAMES
The "name" field MUST be a single proper name as it appears in the text.
FORBIDDEN name patterns:
  ✗ "Geralt/Narrator", "Geralt (implied)", "Geralt/Speaker"
  ✗ "The Host (Unnamed)", "The Companion (Implied)"
  ✗ "The Narrator", "The Protagonist", "The main character"
  ✗ "Local People", "Villagers/Bystanders", "The crowd", "General Characters"
  ✗ "Stregobor (Stregobor)" — double name in parens
ALLOWED examples:
  ✓ "Geralt", "Yennefer", "Stregobor", "Dandelion", "Nivellen"
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

RULE 5 — RESPOND IN ${langName.toUpperCase()}
All text values (appearance, personality, description, etc.) must be written in ${langName}.
If the source text is in Russian, your appearance/personality MUST contain Russian words
that come from the source text. Do not translate to English.

═══════════════════════════════════════════════════════════════
WHAT TO EXTRACT
═══════════════════════════════════════════════════════════════

For EACH named character in the fragment, return an object with fields:
  - name:        the character's actual name (per Rule 2)
  - aliases:     other names/nicknames/titles ONLY if they appear in the text
  - appearance:  literal physical details from text, or "" if none (per Rules 3, 4)
  - personality: literal behavioral details from text, or "" if none (per Rule 3)
  - description: who they are in this fragment (1-3 sentences from text)
  - significance: how important they are in this fragment

Also extract key plot events:
  - summary: 1-2 sentences about what happened
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
    "name": "Yennefer",
    "aliases": [],
    "appearance": "Чёрные локоны тяжёлыми прядями ниспадают на плечи, фиолетовые глаза, на шее чёрная бархотка с обсидиановой звездой",
    "personality": "Холодный взгляд, резкие движения, поморщилась при разговоре",
    "description": "Стоит у окна, общается с Геральтом",
    "significance": "Главная героиня сцены"
  }

BAD OUTPUT (DO NOT DO THIS):
  {
    "name": "Yennefer (Sorceress)",                              ← Rule 2 violated
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

export interface CharacterContext {
  name: string;
  aliases: string[];
  descriptions: string[];
  events: string[];
}

export function classifyPrompt(
  characters: CharacterContext[],
  language: Language = "other",
): string {
  const langName = LANGUAGE_NAMES[language];

  const charactersJson = characters.map((c) => ({
    name: c.name,
    aliases: c.aliases,
    descriptionFragments: c.descriptions,
    eventsParticipating: c.events,
  }));

  return `You are a literary analyst.
Below is a list of REAL characters extracted from a book, with the description fragments
and events for each one. Your tasks: classify by importance, summarize each character,
and write a plot summary.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULES
═══════════════════════════════════════════════════════════════

RULE 1 — NO INVENTION
Use ONLY the data provided in "descriptionFragments" and "eventsParticipating".
NEVER use your training knowledge of the book or character.
If a character has no fragments and no events → put them in "minor" with
description "Информация в тексте отсутствует" (or English equivalent).

RULE 2 — DO NOT ADD CHARACTERS
Use EXACTLY the names from the input list. Do not add new characters.
Do not split or merge characters.

RULE 3 — IMPORTANCE BY ACTIVITY
  - main:      central characters around whom the plot revolves (involved in many events)
  - secondary: important but not central
  - minor:     mentioned briefly, in 1-2 events, or no events at all

RULE 4 — RESPOND IN ${langName.toUpperCase()}
All text values must be in ${langName}.

═══════════════════════════════════════════════════════════════
INPUT
═══════════════════════════════════════════════════════════════

${JSON.stringify(charactersJson, null, 2)}

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return a JSON object with:
  - title:    the book's title (best guess from the descriptions/events; if unclear, write "Unknown")
  - main:     array of character names (from input only)
  - secondary: array of character names (from input only)
  - minor:    array of character names (from input only)
  - characterDetails: array of objects, one per character:
      {
        "name":        (name from input),
        "description": 2-4 sentences synthesized FROM descriptionFragments and eventsParticipating,
        "role":        1-2 sentences about their function in the plot
      }
  - plotSummary:
      {
        "overview":  3-5 paragraphs synthesizing the events into a coherent narrative,
        "keyEvents": list of key events in chronological order (each 1-2 sentences)
      }

Every character name in main/secondary/minor MUST also appear in characterDetails.
Every characterDetails entry MUST have a name from the input list.`;
}

export function summarizeCharacterPrompt(
  name: string,
  appearanceFragments: string[],
  personalityFragments: string[],
  descriptionFragments: string[],
  language: Language = "other",
): string {
  const langName = LANGUAGE_NAMES[language];

  return `You are given raw extracted fragments about a character "${name}" from multiple parts of a book.
Your task: combine them into ONE detailed appearance description, ONE detailed personality description,
and ONE description of the character.

═══════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════

1. PRESERVE EVERY SPECIFIC DETAIL from the fragments. Do not drop information.
2. DO NOT INVENT details that aren't in the fragments.
3. DO NOT use your training knowledge of the character. Only use the fragments below.
4. SKIP fragments that say only "implied", "not described", "unknown", "n/a" — they have no useful data.
   But KEEP any specific detail even if it's surrounded by such phrases.
5. WRITE in ${langName}. Combine into coherent paragraphs.
6. If, after skipping useless fragments, NOTHING specific remains for a field —
   write exactly: "Информация в тексте отсутствует" (or English: "Not described in the text").
   Do not pad with generic phrases.

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

export function bookMetadataPrompt(
  firstChunkText: string,
  language: string,
): string {
  void language;

  return `You are a literary analyst. Extract the book title and author(s) from the following text (first pages of a book).

Look for:
- Title page
- Cover page text
- Header/footer with title
- Author attribution lines
- Copyright page

Return ONLY what you find in the text. If you cannot find title or authors, return empty strings.

Text:
${firstChunkText}`;
}
