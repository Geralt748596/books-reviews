export interface ChunkOptions {
  maxTokens: number;
  overlapTokens: number;
  charsPerToken: number;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  maxTokens: 20_000,
  overlapTokens: 2_000,
  charsPerToken: 3, // для русского текста ~3 символа на токен
};

export interface TextChunk {
  index: number;
  text: string;
  estimatedTokens: number;
}

export function splitIntoChunks(
  text: string,
  options: Partial<ChunkOptions> = {},
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxChars = opts.maxTokens * opts.charsPerToken;
  const overlapChars = opts.overlapTokens * opts.charsPerToken;

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  if (paragraphs.length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? current + "\n\n" + para : para;

    if (candidate.length > maxChars && current.length > 0) {
      chunks.push(makeChunk(chunks.length, current, opts.charsPerToken));

      const tail = current.slice(-overlapChars);
      current = tail + "\n\n" + para;
    } else {
      current = candidate;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(makeChunk(chunks.length, current, opts.charsPerToken));
  }

  return chunks;
}

function makeChunk(
  index: number,
  text: string,
  charsPerToken: number,
): TextChunk {
  return {
    index,
    text: text.trim(),
    estimatedTokens: Math.ceil(text.length / charsPerToken),
  };
}

export function estimateTokens(text: string, charsPerToken = 3): number {
  return Math.ceil(text.length / charsPerToken);
}

export function detectLanguage(text: string): "russian" | "english" | "other" {
  const sample = text.slice(0, 5000);
  const cyrillic = (sample.match(/[\u0400-\u04FF]/g) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;

  if (cyrillic > latin * 0.5) return "russian";
  if (latin > 100) return "english";
  return "other";
}
