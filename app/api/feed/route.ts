import { auth } from "@/lib/auth";
import { parseCursor } from "@/lib/feed/cursor";
import { getHomeFeedPage } from "@/lib/feed/queries";

/**
 * Следующие страницы ленты для «Load more». Публичная часть закэширована по
 * курсору внутри getPublicFeedPage; ответ содержит лайки пользователя,
 * поэтому на HTTP-уровне не кэшируется.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseCursor(searchParams);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  const page = await getHomeFeedPage(parsed.cursor, session?.user.id ?? null);

  return Response.json(page, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
