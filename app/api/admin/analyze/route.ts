import fs from "node:fs";
import fsPromises, { writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { extractTextFromPdf } from "@/lib/analyzer/pdf-extractor";
import { analyzeBook } from "@/lib/analyzer/analyzer";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (session.user?.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pdf = searchParams.get("pdf");
  const model = searchParams.get("model");
  const title = searchParams.get("title") ?? undefined;

  if (!pdf || !model) {
    return new Response("Missing pdf or model query param", { status: 400 });
  }

  const pdfPath = path.join(process.cwd(), pdf);
  const basename = path.basename(pdf, path.extname(pdf));
  const outputPath = path.join(
    process.cwd(),
    "lib/analyzer/generated",
    model,
    basename + ".analysis.json",
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: object) {
        controller.enqueue(
          encoder.encode("data: " + JSON.stringify(payload) + "\n\n"),
        );
      }

      try {
        if (fs.existsSync(outputPath)) {
          const existing = JSON.parse(
            await fsPromises.readFile(outputPath, "utf-8"),
          );
          send({
            type: "done",
            outputPath,
            result: {
              title: existing.title ?? basename,
              characterCount: Array.isArray(existing.characters)
                ? existing.characters.length
                : 0,
            },
          });
          controller.close();
          return;
        }

        send({ type: "progress", message: "Extracting text from PDF…" });
        const { text } = await extractTextFromPdf(pdfPath);
        send({
          type: "progress",
          message: `Text extracted (${text.length.toLocaleString()} characters). Starting analysis…`,
        });

        await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });

        send({ type: "progress", message: "Analyzing book with LLM…" });
        const result = await analyzeBook({ text, model, outputPath, title });
        await writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8");

        send({
          type: "done",
          outputPath,
          result: {
            title: result.title ?? basename,
            characterCount: Array.isArray(result.characters)
              ? result.characters.length
              : 0,
          },
        });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
