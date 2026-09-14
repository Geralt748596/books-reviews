import path from "node:path";
import { auth } from "@/lib/auth";
import { publishBook } from "@/lib/analyzer/publish";

const GENERATED_ROOT = path.join(process.cwd(), "lib/analyzer/generated");

function isWithinGeneratedRoot(absolutePath: string) {
  const normalizedRoot = path.resolve(GENERATED_ROOT) + path.sep;
  const normalizedPath = path.resolve(absolutePath);

  return (
    normalizedPath === path.resolve(GENERATED_ROOT) ||
    normalizedPath.startsWith(normalizedRoot)
  );
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jsonPath } = (await request.json()) as { jsonPath?: string };

  if (!jsonPath) {
    return Response.json({ error: "jsonPath is required" }, { status: 400 });
  }

  const absolutePath = path.resolve(process.cwd(), jsonPath);

  if (!isWithinGeneratedRoot(absolutePath)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await publishBook(absolutePath, { onProgress: undefined });

  return Response.json({ success: true, bookId: result.bookId });
}
