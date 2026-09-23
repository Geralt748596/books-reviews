import { requireAdmin } from "@/lib/admin-auth";
import { getEvents, getJob } from "@/lib/analyzer/jobs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  const { id } = await params;
  const job = getJob(id);
  if (!job)
    return Response.json({ error: "Задача не найдена" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const after = Number.parseInt(searchParams.get("after") ?? "0", 10) || 0;
  const events = getEvents(id, after);

  return Response.json({
    ...job,
    events: events?.events ?? [],
    truncated: events?.truncated ?? false,
  });
}
