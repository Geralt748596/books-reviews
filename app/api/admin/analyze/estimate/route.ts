import { badRequest, requireAdmin } from "@/lib/admin-auth";
import {
  estimateRequestSchema,
  resolveBookPdf,
  zodMessage,
} from "@/lib/analyzer/api-schemas";
import { estimateBook } from "@/lib/analyzer/run";

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  const parsed = estimateRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(zodMessage(parsed.error));

  try {
    const pdfPath = resolveBookPdf(parsed.data.pdf);
    const estimate = await estimateBook(pdfPath, parsed.data.model);
    return Response.json(estimate);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : String(error));
  }
}
