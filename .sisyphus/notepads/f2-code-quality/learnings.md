## F2: Code Quality Review — Findings (2026-03-29)

### Build
- `pnpm build` exits 0, no TS errors, no compile errors.
- Routes: /, /api/auth/[...all], /api/books/search, /book/[id], /gallery, /login, /search — all rendered correctly.

### Lint (pnpm eslint .)
EXIT: 0 (non-blocking exit code despite errors due to eslint config)
- **2 ERRORS** (actual blocking issues):
  1. `components/book-tabs.tsx:31` — `react-hooks/set-state-in-effect`: calling `setActiveTab(tab)` synchronously in useEffect. Triggers cascading renders.
  2. `components/image-generator.tsx:39` — same rule: `setCharacterId(charFromUrl)` in useEffect.
- **6 WARNINGS**:
  - `@next/next/no-img-element` — using `<img>` instead of `<Image />` in 5 components: book/[id]/page.tsx, gallery-card.tsx, gallery-modal.tsx, image-card.tsx, image-generator.tsx (+ search/page.tsx uses eslint-disable comment to suppress it legitimately)
  - `@typescript-eslint/no-unused-vars` — `total` in gallery/page.tsx line 16 destructured but unused

### Anti-patterns Check
- `as any` — NONE found ✅
- `@ts-ignore/@ts-nocheck` — NONE found ✅
- `console.log` (bare) — NONE found ✅
- `console.error` — 5 occurrences but ALL gated behind `process.env.NODE_ENV === "development"` guard ✅
- Empty catch blocks `catch {}` — NONE found (all catch blocks return error responses) ✅
- TODO/FIXME/HACK — NONE found ✅
- `as unknown as` — 5 occurrences: 2 are the standard globalThis singleton pattern (db.ts, openai.ts) ✅; 3 in gallery.ts to cast Prisma result to custom type — acceptable workaround ⚠️ minor

### Async API Usage
- `headers()` — ALL 10 occurrences use `await headers()` ✅
- `cookies()` — not used directly (better-auth handles internally) ✅
- `await params` — both occurrences in book/[id]/page.tsx correctly await params ✅
- `await searchParams` — gallery/page.tsx correctly awaits searchParams ✅

### No middleware.ts
- `middleware.ts` does NOT exist — only `proxy.ts` ✅

### Other Observations
- `gallery/page.tsx:16` — `total` is destructured but never used in JSX (only `images` and `totalPages` are used) — minor unused var
- `lib/actions/gallery.ts` — uses `as unknown as GalleryImageWithRelations[]` cast because Prisma `include` type doesn't match custom type exactly. Not unsafe, just a type gap.
- `book/[id]/page.tsx:94-96` — empty-looking catch that has a comment `// Ignore DB errors to ensure page renders` — intentional, acceptable.
- `search/page.tsx` — uses `// eslint-disable-next-line @next/next/no-img-element` inline suppression. Not counted as a violation.

### Files Reviewed: 37 total
- lib/: auth.ts, auth-client.ts, db.ts, openai.ts, google-books.ts, blob-storage.ts, utils.ts (7)
- lib/actions/: books.ts, reviews.ts, characters.ts, images.ts, gallery.ts (5)
- app/api/: auth/[...all]/route.ts, books/search/route.ts (2)
- app/(main)/: layout.tsx, search/page.tsx, book/[id]/page.tsx, gallery/page.tsx (4)
- app/(auth)/: login/page.tsx, layout.tsx (2)
- app/: layout.tsx, page.tsx (2)
- components/: book-tabs.tsx, image-generator.tsx, character-list.tsx, character-list-client.tsx, character-card.tsx, character-form.tsx, character-suggestions.tsx, review-list.tsx, review-card.tsx, review-form.tsx, gallery-card.tsx, gallery-modal.tsx, image-card.tsx, star-rating.tsx, user-nav.tsx, main-nav.tsx, dark-mode-toggle.tsx, theme-provider.tsx (18)
- proxy.ts (1)
