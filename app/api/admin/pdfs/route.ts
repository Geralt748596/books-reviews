import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { requireAdmin } from "@/lib/admin-auth";
import { BOOKS_ROOT } from "@/lib/analyzer/run";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  let names: string[] = [];
  try {
    names = await readdir(BOOKS_ROOT);
  } catch {
    return Response.json([]);
  }

  const files = await Promise.all(
    names
      .filter((name) => name.toLowerCase().endsWith(".pdf"))
      .map(async (filename) => {
        const info = await stat(join(BOOKS_ROOT, filename));
        return {
          filename,
          sizeBytes: info.size,
          modifiedAt: info.mtime.toISOString(),
        };
      }),
  );

  files.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
  return Response.json(files);
}
