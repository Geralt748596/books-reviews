## 2026-05-06
- Seed books now use fixed `id` values so Prisma upserts can target `where: { id }` after removing `googleBooksId`.
- Character seed data can reference book seed IDs directly; no lookup map is needed.
