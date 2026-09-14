import fs from "node:fs";
import path from "node:path";
import { auth } from "@/lib/auth";

const GENERATED_ROOT = path.join(process.cwd(), "lib/analyzer/generated");

function isWithinGeneratedRoot(absolutePath: string) {
  const normalizedRoot = path.resolve(GENERATED_ROOT) + path.sep;
  const normalizedPath = path.resolve(absolutePath);

  return (
    normalizedPath === path.resolve(GENERATED_ROOT) ||
    normalizedPath.startsWith(normalizedRoot)
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { file } = await params;
  const absolutePath = Buffer.from(file, "base64url").toString();

  if (!isWithinGeneratedRoot(absolutePath)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const contents = fs.readFileSync(absolutePath, "utf-8");

  return Response.json(JSON.parse(contents));
}
