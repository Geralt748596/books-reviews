import fs from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const MAX_PDF_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "File is required" }, { status: 400 });
  }

  if (file.type !== "application/pdf" || file.size > MAX_PDF_SIZE) {
    return Response.json(
      { error: "File must be a PDF and no larger than 50MB" },
      { status: 400 },
    );
  }

  const saveDir = path.join(process.cwd(), "lib/analyzer/books");
  const savePath = path.join(saveDir, file.name);

  await fs.mkdir(saveDir, { recursive: true });
  const bytes = await file.arrayBuffer();
  await fs.writeFile(savePath, Buffer.from(bytes));

  return Response.json({
    success: true,
    path: savePath,
    filename: file.name,
  });
}
