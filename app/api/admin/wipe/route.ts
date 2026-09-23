import { requireAdmin } from "@/lib/admin-auth";
import { wipeContent } from "@/lib/db/wipe-content";

export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult.response) return authResult.response;

  const deleted = await wipeContent();
  return Response.json({ deleted });
}
