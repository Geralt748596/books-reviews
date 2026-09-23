import { requireAdmin } from "@/lib/admin-auth";
import { cancelJob } from "@/lib/analyzer/jobs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  const { id } = await params;
  const job = cancelJob(id);
  if (!job)
    return Response.json({ error: "Задача не найдена" }, { status: 404 });
  return Response.json(job);
}
