import { badRequest, requireAdmin } from "@/lib/admin-auth";
import {
  createJobRequestSchema,
  resolveBookPdf,
  zodMessage,
} from "@/lib/analyzer/api-schemas";
import { createJob, listJobs } from "@/lib/analyzer/jobs";
import { defaultOutputPath } from "@/lib/analyzer/run";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;
  return Response.json(listJobs());
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  const parsed = createJobRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest(zodMessage(parsed.error), parsed.error.issues);

  const { pdf, ...rest } = parsed.data;
  let pdfPath: string;
  try {
    pdfPath = resolveBookPdf(pdf);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : String(error));
  }

  const job = createJob({
    ...rest,
    pdfPath,
    outputPath: defaultOutputPath(pdfPath, rest.model, rest.chunkTokens),
  });

  return Response.json(job, { status: 202 });
}
