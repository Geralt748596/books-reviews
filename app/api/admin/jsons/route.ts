import fs from "node:fs";
import path from "node:path";
import { auth } from "@/lib/auth";

type AnalysisFile = {
  title?: string;
  authors?: string[];
  book?: {
    title?: string;
    authors?: string[];
  };
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
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const files = collectAnalysisFiles(GENERATED_ROOT)
    .filter(isWithinGeneratedRoot)
    .map((absolutePath) => {
      const raw = fs.readFileSync(absolutePath, "utf-8");
      const analysis = JSON.parse(raw) as AnalysisFile;
      const stat = fs.statSync(absolutePath);
      const title = analysis.title ?? analysis.book?.title ?? null;
      const authors = analysis.authors ?? analysis.book?.authors ?? [];

      return {
        path: absolutePath,
        relativePath: path.relative(process.cwd(), absolutePath),
        title,
        authors,
        createdAt: stat.mtime.toISOString(),
      };
    });

  return Response.json(files);
}
