import {
  getOllamaHost,
  hasOllamaApiKey,
  isDirectOllamaCloud,
} from "./llm-client";

/**
 * Каталог моделей для селекта в админке. Статический: каталог ollama.com не
 * отдаёт ни лимитов, ни цен, поэтому список поддерживается руками.
 */

export type ModelProvider = "ollama-cloud" | "ollama-local" | "claude";

export interface ModelInfo {
  id: string;
  label: string;
  provider: ModelProvider;
  isDefault?: boolean;
  note?: string;
}

export const DEFAULT_MODEL = "deepseek-v4.1-flash";

export const MODEL_CATALOG: ModelInfo[] = [
  {
    id: "deepseek-v4.1-flash",
    label: "DeepSeek V4.1 Flash",
    provider: "ollama-cloud",
    isDefault: true,
    note: "Проверена на полной книге: 100k токенов на фрагмент, ~5 мин на роман",
  },
  {
    id: "deepseek-v4-flash:0731",
    label: "DeepSeek V4 Flash (0731)",
    provider: "ollama-cloud",
  },
  {
    id: "qwen3.5:latest",
    label: "Qwen 3.5 (локально)",
    provider: "ollama-local",
    note: "Нужен запущенный сервер Ollama с загруженной моделью",
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    provider: "claude",
    note: "Нужен ANTHROPIC_API_KEY; доступен режим batch",
  },
  {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    provider: "claude",
    note: "Нужен ANTHROPIC_API_KEY; дороже Sonnet в 2,5 раза",
  },
];

export interface ProviderAvailability {
  ollama: {
    host: string;
    directCloud: boolean;
    hasApiKey: boolean;
    reachable: boolean;
    error?: string;
  };
  claude: {
    hasApiKey: boolean;
  };
}

export interface ModelOption extends ModelInfo {
  available: boolean;
  /** Что настроить, если модель недоступна. */
  unavailableReason?: string;
}

/** Проверяет, до какого сервера Ollama мы дотягиваемся, и есть ли ключи. */
export async function getProviderAvailability(): Promise<ProviderAvailability> {
  const host = getOllamaHost();
  const directCloud = isDirectOllamaCloud();
  const hasApiKey = hasOllamaApiKey();

  let reachable = false;
  let error: string | undefined;
  try {
    const response = await fetch(`${host.replace(/\/$/, "")}/api/version`, {
      signal: AbortSignal.timeout(2_500),
    });
    reachable = response.ok;
    if (!response.ok) error = `HTTP ${response.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return {
    ollama: { host, directCloud, hasApiKey, reachable, error },
    claude: { hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY) },
  };
}

export function describeModelOptions(
  availability: ProviderAvailability,
): ModelOption[] {
  const { ollama, claude } = availability;

  return MODEL_CATALOG.map((model) => {
    let available = true;
    let unavailableReason: string | undefined;

    switch (model.provider) {
      case "claude":
        if (!claude.hasApiKey) {
          available = false;
          unavailableReason = "Задайте ANTHROPIC_API_KEY в .env";
        }
        break;
      case "ollama-cloud":
        if (ollama.directCloud) {
          if (!ollama.hasApiKey) {
            available = false;
            unavailableReason = "Задайте OLLAMA_API_KEY для https://ollama.com";
          }
        } else if (!ollama.reachable) {
          available = false;
          unavailableReason = `Сервер Ollama ${ollama.host} не отвечает`;
        }
        break;
      case "ollama-local":
        if (ollama.directCloud) {
          available = false;
          unavailableReason =
            "OLLAMA_HOST указывает на облако; локальные модели недоступны";
        } else if (!ollama.reachable) {
          available = false;
          unavailableReason = `Сервер Ollama ${ollama.host} не отвечает`;
        }
        break;
    }

    return { ...model, available, unavailableReason };
  });
}
