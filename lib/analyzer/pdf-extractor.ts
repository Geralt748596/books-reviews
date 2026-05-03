import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

export interface ExtractedPdf {
  text: string;
  totalPages: number;
}

export async function extractTextFromPdf(
  pdfPath: string,
): Promise<ExtractedPdf> {
  const buffer = await readFile(pdfPath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  const result = await parser.getText();
  await parser.destroy();

  const text = result.text.trim();
  if (!text) {
    throw new Error(`PDF не содержит извлекаемого текста: ${pdfPath}`);
  }

  return {
    text,
    totalPages: result.total,
  };
}
