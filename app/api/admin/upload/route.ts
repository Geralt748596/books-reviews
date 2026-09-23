import fs from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/admin-auth";

const MAX_PDF_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

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
  const filename = path.basename(file.name);
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return Response.json(
      { error: "Имя файла должно оканчиваться на .pdf" },
      { status: 400 },
    );
  }
  const savePath = path.join(saveDir, filename);

  await fs.mkdir(saveDir, { recursive: true });
  const bytes = await file.arrayBuffer();
  await fs.writeFile(savePath, Buffer.from(bytes));

  return Response.json({
    success: true,
    path: savePath,
    filename,
  });
}
