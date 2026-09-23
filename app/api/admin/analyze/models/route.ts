import { requireAdmin } from "@/lib/admin-auth";
import {
  DEFAULT_MODEL,
  describeModelOptions,
  getProviderAvailability,
} from "@/lib/analyzer/models";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  const availability = await getProviderAvailability();
  return Response.json({
    defaultModel: DEFAULT_MODEL,
    models: describeModelOptions(availability),
    availability,
  });
}
