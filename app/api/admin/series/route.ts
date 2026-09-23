import { badRequest, requireAdmin } from "@/lib/admin-auth";
import {
  createSeriesRequestSchema,
  zodMessage,
} from "@/lib/analyzer/api-schemas";
import prisma from "@/lib/db";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  const series = await prisma.bookSeries.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { books: true } } },
  });

  return Response.json(
    series.map((s) => ({ id: s.id, name: s.name, booksCount: s._count.books })),
  );
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  const parsed = createSeriesRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(zodMessage(parsed.error));

  // Одноимённую серию не дублируем
  const existing = await prisma.bookSeries.findFirst({
    where: { name: { equals: parsed.data.name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) return Response.json({ ...existing, created: false });

  const created = await prisma.bookSeries.create({
    data: { name: parsed.data.name },
    select: { id: true, name: true },
  });
  return Response.json({ ...created, created: true }, { status: 201 });
}
