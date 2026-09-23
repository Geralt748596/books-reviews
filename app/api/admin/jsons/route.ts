import fs from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/admin-auth";
import { readAnalysisMeta } from "@/lib/analyzer/run";

type AnalysisFile = {
  title?: string;
  authors?: string;
  language?: string;
  characters?: { main?: unknown[]; secondary?: unknown[]; minor?: unknown[] };
  plotSummary?: { keyEvents?: unknown[] };
};

const GENERATED_ROOT = path.join(process.cwd(), "lib/analyzer/generated");

function isWithinGeneratedRoot(absolutePath: string) {
  const normalizedRoot = path.resolve(GENERATED_ROOT) + path.sep;
  const normalizedPath = path.resolve(absolutePath);

  return (
    normalizedPath === path.resolve(GENERATED_ROOT) ||
    normalizedPath.startsWith(normalizedRoot)
  );
}

function collectAnalysisFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectAnalysisFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".analysis.json")) {
      files.push(absolutePath);
    }
  }

  return files;
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  const files = await Promise.all(
    collectAnalysisFiles(GENERATED_ROOT)
      .filter(isWithinGeneratedRoot)
      .map(async (absolutePath) => {
        const raw = fs.readFileSync(absolutePath, "utf-8");
        const analysis = JSON.parse(raw) as AnalysisFile;
        const stat = fs.statSync(absolutePath);
        const meta = await readAnalysisMeta(absolutePath);

        return {
          path: absolutePath,
          relativePath: path.relative(process.cwd(), absolutePath),
          title: analysis.title ?? null,
          authors: analysis.authors ?? "",
          language: analysis.language ?? null,
          characters: {
            main: analysis.characters?.main?.length ?? 0,
            secondary: analysis.characters?.secondary?.length ?? 0,
            minor: analysis.characters?.minor?.length ?? 0,
          },
          events: analysis.plotSummary?.keyEvents?.length ?? 0,
          createdAt: stat.mtime.toISOString(),
          // из сайдкара, если анализ запускался новым раннером
          model: meta?.model ?? null,
          chunkTokens: meta?.chunkTokens ?? null,
          bookSeriesId: meta?.bookSeriesId ?? null,
        };
      }),
  );

  files.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return Response.json(files);
}
