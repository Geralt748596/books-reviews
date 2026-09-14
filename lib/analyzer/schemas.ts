import { z } from "zod/v3";

// --- Проход 1: анализ одного чанка ---

export const ChunkCharacterSchema = z.object({
  name: z.string().describe("Основное имя персонажа"),
  aliases: z
    .array(z.string())
    .default([])
    .describe("Другие имена, прозвища, титулы"),
  appearance: z
    .string()
    .default("")
    .describe(
      "Внешность: рост, телосложение, цвет волос/глаз, шрамы, одежда, возраст и т.д.",
    ),
  personality: z
    .string()
    .default("")
    .describe(
      "Характер и манера поведения: темперамент, привычки, речь, отношение к другим",
    ),
  description: z
    .string()
    .default("")
    .describe("Общее описание: кто этот персонаж, его история, мотивация"),
  significance: z
    .string()
    .default("")
    .describe("Насколько важен в данном фрагменте: краткое пояснение"),
});

export const ChunkEventSchema = z.object({
  summary: z.string().describe("Краткое описание события"),
  charactersInvolved: z
    .array(z.string())
    .default([])
    .describe("Имена персонажей, участвующих в событии"),
});

export const ChunkAnalysisSchema = z.object({
  characters: z
    .array(ChunkCharacterSchema)
    .describe("Персонажи, найденные в этом фрагменте"),
  events: z
    .array(ChunkEventSchema)
    .describe("Ключевые события сюжета в этом фрагменте"),
});

// --- Проход 1.5: сопоставление алиасов между фрагментами ---

export const AliasGroupSchema = z.object({
  canonicalName: z
    .string()
    .describe("Основное имя персонажа (одно из members)"),
  members: z
    .array(z.string())
    .default([])
    .describe("Все имена из входного списка, относящиеся к этому персонажу"),
  confidence: z
    .enum(["high", "medium", "low"])
    .default("medium")
    .describe(
      "Уверенность, что все members — один персонаж; объединяются только high",
    ),
  evidence: z.string().default("").describe("На чём основано объединение"),
});

export const AliasResolutionSchema = z.object({
  groups: z.array(AliasGroupSchema).default([]),
});

// --- Проход 2: только классификация и сюжет (appearance/personality добавляются программно) ---

export const ClassifiedCharacterSchema = z.object({
  name: z.string().describe("Имя персонажа (точно как в входных данных)"),
  description: z
    .string()
    .default("")
    .describe(
      "Общее описание персонажа: происхождение, история, мотивация, ключевые поступки",
    ),
  role: z.string().default("").describe("Роль персонажа в сюжете"),
});

export const ClassificationSchema = z.object({
  title: z.string().default("Unknown").describe("Название книги"),
  main: z.array(z.string()).default([]).describe("Имена главных героев"),
  secondary: z
    .array(z.string())
    .default([])
    .describe("Имена второстепенных персонажей"),
  minor: z
    .array(z.string())
    .default([])
    .describe("Имена эпизодических персонажей"),
  characterDetails: z
    .array(ClassifiedCharacterSchema)
    .default([])
    .describe("Описание и роль каждого персонажа"),
  plotSummary: z
    .object({
      overview: z
        .string()
        .default("")
        .describe("Общее краткое содержание книги"),
      keyEvents: z
        .array(z.string())
        .default([])
        .describe("Список ключевых событий сюжета по порядку"),
    })
    .default({ overview: "", keyEvents: [] }),
});

// --- Проход 2.5: саммаризация данных о персонаже ---

export const CharacterSummarySchema = z.object({
  appearance: z
    .string()
    .default("")
    .describe("Подробное описание внешности персонажа"),
  personality: z
    .string()
    .default("")
    .describe("Подробное описание характера и поведения персонажа"),
  description: z
    .string()
    .default("")
    .describe(
      "Общее описание персонажа: история, мотивация, ключевые поступки",
    ),
});

// --- Финальный формат вывода (собирается программно) ---

export const CharacterSchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  appearance: z.string(),
  personality: z.string(),
  description: z.string(),
  role: z.string(),
});

export const BookAnalysisSchema = z.object({
  title: z.string(),
  authors: z.string().default(""),
  language: z.string().default(""),
  characters: z.object({
    main: z.array(CharacterSchema),
    secondary: z.array(CharacterSchema),
    minor: z.array(CharacterSchema),
  }),
  plotSummary: z.object({
    overview: z.string(),
    keyEvents: z.array(z.string()),
  }),
});

export const BookMetadataSchema = z.object({
  title: z.string().describe("The book's title"),
  authors: z
    .string()
    .describe("The book's author(s), comma-separated if multiple"),
});
