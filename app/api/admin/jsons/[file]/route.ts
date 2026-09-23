import fs from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/admin-auth";

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
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  const { file } = await params;
  const absolutePath = Buffer.from(file, "base64url").toString();

  if (!isWithinGeneratedRoot(absolutePath)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const contents = fs.readFileSync(absolutePath, "utf-8");

  return Response.json(JSON.parse(contents));
}
