## 2026-05-06
- Seed books now use fixed `id` values so Prisma upserts can target `where: { id }` after removing `googleBooksId`.
- Character seed data can reference book seed IDs directly; no lookup map is needed.
- `lib/analyzer/llm-client.ts` now exposes `searchPublishedDate()` for a simple Ollama chat-based year lookup with null-on-failure behavior.
- Added `BookMetadataSchema` and `bookMetadataPrompt` as standalone analyzer exports without touching existing analyzer flows.
