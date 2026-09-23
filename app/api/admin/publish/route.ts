import { badRequest, requireAdmin } from "@/lib/admin-auth";
import {
  publishRequestSchema,
  resolveGeneratedJson,
  zodMessage,
} from "@/lib/analyzer/api-schemas";
import { publishBook } from "@/lib/analyzer/publish";
import { HOME_FEED_TAG } from "@/lib/feed/tags";
import { revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  const parsed = publishRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest(zodMessage(parsed.error), parsed.error.issues);

  let absolutePath: string;
  try {
    absolutePath = resolveGeneratedJson(parsed.data.jsonPath);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Forbidden" },
      { status: 403 },
    );
  }

  const log: string[] = [];
  try {
    const result = await publishBook(absolutePath, {
      bookSeriesId: parsed.data.bookSeriesId,
      publishedDate: parsed.data.publishedDate,
      model: parsed.data.model,
      skipImages: parsed.data.skipImages,
      dryRun: parsed.data.dryRun,
      onProgress: (message) => log.push(message),
    });
    // В route handler updateTag недоступен; профиль обязателен в этой версии Next
    if (!result.dryRun) revalidateTag(HOME_FEED_TAG, "max");
    return Response.json({ success: true, ...result, log });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : String(error),
        log,
      },
      { status: 500 },
    );
  }
}
