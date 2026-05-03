import ollama from "ollama";
import type { ZodSchema } from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface LlmRequestOptions {
  model: string;
  prompt: string;
  schema: ZodSchema;
  maxRetries?: number;
  temperature?: number;
  timeoutMs?: number;
}

interface RetryState {
  attempt: number;
  lastError?: string;
}

export async function llmStructuredRequest<T>(
  options: LlmRequestOptions,
): Promise<T> {
  const {
    model,
    prompt,
    schema,
    maxRetries = 3,
    temperature = 0.1,
    timeoutMs = 10 * 60 * 1000, // 10 минут по умолчанию
  } = options;

  const isCloud = model.endsWith(":cloud");
  const { $schema: _, ...jsonSchema } = zodToJsonSchema(schema);

  const promptTokens = Math.ceil(prompt.length / 3);
  log(
    `Промпт: ~${promptTokens.toLocaleString()} токенов, модель: ${model}, cloud: ${isCloud}`,
  );

  const state: RetryState = { attempt: 0 };

  while (state.attempt < maxRetries) {
    state.attempt++;
    const startTime = Date.now();

    log(`Попытка ${state.attempt}/${maxRetries}...`);

    try {
      const response = await ollama.chat({
        model,
        messages: [{ role: "user", content: prompt }],
        format: isCloud ? undefined : jsonSchema,
        think: false,
        options: { temperature, top_p: 0.9, top_k: 40 },
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const contentLen = response.message.content.length;
      log(`Ответ получен за ${elapsed}с, ${contentLen} символов`);

      const content = response.message.content;
      let parsed: unknown;

      try {
        parsed = parseJsonResponse(content);
      } catch (parseErr) {
        const preview = content.slice(0, 200);
        log(`Ошибка парсинга JSON. Начало ответа: ${preview}`);
        throw parseErr;
      }

      try {
        const preprocessed = coerceArraysToStrings(parsed);
        return schema.parse(preprocessed) as T;
      } catch (validationErr) {
        const keys =
          parsed && typeof parsed === "object" ? Object.keys(parsed) : [];
        log(`Ошибка валидации Zod. Ключи ответа: [${keys.join(", ")}]`);
        log(`Начало ответа: ${JSON.stringify(parsed).slice(0, 300)}`);
        log(
          `Zod: ${validationErr instanceof Error ? validationErr.message : validationErr}`,
        );
        throw validationErr;
      }
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : "Unknown";

      state.lastError = errorMsg;
      log(`Ошибка (${errorName}) через ${elapsed}с: ${errorMsg}`);

      if (state.attempt >= maxRetries) {
        throw new Error(
          `LLM запрос не удался после ${maxRetries} попыток. ` +
            `Модель: ${model}. Последняя ошибка: ${state.lastError}`,
        );
      }

      const delayMs = Math.min(1000 * 2 ** state.attempt, 30_000);
      log(`Ожидание ${(delayMs / 1000).toFixed(0)}с перед повтором...`);
      await sleep(delayMs);
    }
  }

  throw new Error("Unreachable");
}

function parseJsonResponse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // ignore, try extracting from fences
  }

  const fenced = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenced) {
    return JSON.parse(fenced[1]);
  }

  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    return JSON.parse(braceMatch[0]);
  }

  throw new SyntaxError(
    `Cannot extract JSON from response: ${content.slice(0, 100)}`,
  );
}

function coerceArraysToStrings(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    if (obj.length > 0 && obj.every((item) => typeof item === "string")) {
      return obj;
    }
    return obj.map(coerceArraysToStrings);
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const STRING_FIELDS = [
        "appearance",
        "personality",
        "description",
        "significance",
        "summary",
        "overview",
        "role",
      ];
      if (STRING_FIELDS.includes(key) && Array.isArray(value)) {
        result[key] = value.filter((v) => typeof v === "string").join(". ");
      } else {
        result[key] = coerceArraysToStrings(value);
      }
    }
    return result;
  }
  return obj;
}

function log(message: string): void {
  const time = new Date().toLocaleTimeString("ru-RU", { hour12: false });
  console.log(`  [${time}] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
