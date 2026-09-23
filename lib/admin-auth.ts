import { auth } from "@/lib/auth";

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

/**
 * Проверка администратора для route handlers.
 * Возвращает либо сессию, либо готовый ответ 401/403, который нужно вернуть как есть.
 */
export async function requireAdmin(
  request: Request,
): Promise<
  | { session: Session; response?: undefined }
  | { session?: undefined; response: Response }
> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return {
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.user.role !== "admin") {
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** Единый формат ошибки валидации. */
export function badRequest(message: string, details?: unknown): Response {
  return Response.json({ error: message, details }, { status: 400 });
}
