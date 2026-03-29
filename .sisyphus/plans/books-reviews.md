# Books Reviews App — Full-Stack Implementation Plan

## TL;DR

> **Quick Summary**: Build a full-stack book review app where users search for books (Google Books API, multilingual), leave reviews, manage characters (AI-suggested + manual), generate AI illustrations (OpenAI → Vercel Blob), and browse a public image gallery — all authenticated via better-auth (Google OAuth) with PostgreSQL (Neon) + Prisma.
> 
> **Deliverables**:
> - Authentication system (better-auth + Google OAuth + Prisma adapter)
> - Book search with multilingual support (Google Books API)
> - Reviews CRUD (star rating + text)
> - Character management (AI extraction + manual input, shared per book)
> - AI image generation (OpenAI gpt-image-1 → Vercel Blob storage)
> - Public image gallery searchable by book and character
> - Full UI shell with shadcn/ui, dark mode, responsive layout
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 5 waves
> **Critical Path**: T1 Foundation → T2 Auth → T3 Schema → T5 Book Search → T7 Reviews → T9 Characters → T11 Image Gen → T13 Gallery → T15 Shell

---

## Context

### Original Request
Создать фронтенд и бэкенд часть приложения books-reviews: PostgreSQL + Prisma, поиск книг по названию на разных языках (Google Books API), отзывы о книгах, генерация изображений с помощью OpenAI по описанию персонажа или всей книги (связано с ID персонажа и ID книги), поиск изображений другими пользователями, авторизация через better-auth (отдельный пункт плана), фронтенд на shadcn/ui + Tailwind.

### Interview Summary
**Key Discussions**:
- **Characters**: Комбинация AI + ручной ввод — AI предлагает из описания книги, пользователь может добавить/удалить
- **Image Storage**: Vercel Blob (OpenAI URLs expire ~1h)
- **Database**: Neon PostgreSQL (dev + prod)
- **Auth**: Только Google OAuth через better-auth
- **Tests**: Нет автоматических тестов, только QA сценарии агентов

**Research Findings**:
- shadcn/ui v4 полностью совместим с Tailwind v4, оставлять tailwind.config ПУСТЫМ
- better-auth работает с Next.js 16 через `--legacy-peer-deps`, есть PR #8462 для router refresh bug
- Google Books API: ~1000 req/day free tier, НЕ содержит данные о персонажах
- OpenAI Images: gpt-image-1 $0.034-0.133/image, ВСЕГДА использовать b64_json
- Prisma: singleton через globalThis, better-auth таблицы User/Session/Account/Verification

### Metis Review
**Identified Gaps** (addressed):
- **CRITICAL**: Next.js 16 uses `proxy.ts` (NOT `middleware.ts`) — all auth guards use proxy convention
- **CRITICAL**: All request APIs async (`await cookies()`, `await headers()`, `await params`) — enforced in every task
- **CRITICAL**: Turbopack by default — no webpack config allowed
- **CRITICAL**: `images.remotePatterns` (NOT `images.domains`) for Google Books covers + Vercel Blob URLs
- **IMPORTANT**: Must read `node_modules/next/dist/docs/` before implementing features (AGENTS.md directive)
- **RISK**: better-auth `toNextJsHandler` may not handle async params — verification step added
- **RISK**: Google Books API 1000 req/day — book metadata cached in DB on first interaction
- **RISK**: OpenAI cost explosion — per-user daily generation cap in server action

---

## Work Objectives

### Core Objective
Build a production-ready books-reviews app where authenticated users can search books, leave reviews, manage characters, generate AI illustrations, and browse a shared image gallery.

### Concrete Deliverables
- `app/api/auth/[...all]/route.ts` — better-auth API handler
- `app/api/books/search/route.ts` — Google Books API proxy
- `app/api/images/generate/route.ts` — OpenAI image generation endpoint
- `prisma/schema.prisma` — Full database schema (8 models)
- `app/(main)/` — Authenticated app routes (search, book detail, reviews, gallery, generate)
- `app/(auth)/` — Login/signup pages
- `lib/auth.ts`, `lib/auth-client.ts`, `lib/db.ts` — Core server/client utilities
- `components/ui/` — shadcn/ui components
- `proxy.ts` — Auth session guard

### Definition of Done
- [ ] `pnpm build` succeeds without errors
- [ ] Google OAuth login/logout works end-to-end
- [ ] Book search returns results in English and Russian
- [ ] User can leave a review with star rating
- [ ] User can generate an image for a book or character
- [ ] Generated images are stored in Vercel Blob (permanent URLs)
- [ ] Other users can browse and search generated images
- [ ] Dark mode toggle works

### Must Have
- Authentication via better-auth with Google OAuth (SEPARATE plan section)
- Book search via Google Books API with `langRestrict` for multilingual
- Book metadata stored in DB on first interaction (avoid repeated API calls)
- Reviews with 1-5 star rating and text content (one per user per book, editable)
- Characters: AI-suggested from book description + user can add/edit/remove (shared per book)
- Image generation: OpenAI gpt-image-1 → b64_json → Vercel Blob
- Images linked to bookId + optional characterId
- Image gallery searchable by book title and character name
- Dark mode via next-themes
- shadcn/ui components throughout

### Must NOT Have (Guardrails)
- **NO `middleware.ts`** — Next.js 16 uses `proxy.ts` with `export function proxy()`
- **NO synchronous request APIs** — `cookies()`, `headers()`, `params`, `searchParams` ALL require `await`
- **NO `images.domains`** — use `images.remotePatterns` only
- **NO `tailwind.config.*`** — Tailwind v4 uses CSS-first config via `@theme inline`
- **NO webpack config** — Turbopack is default in Next.js 16
- **NO `next lint`** — removed in Next.js 16, use `pnpm eslint` directly
- **NO email/password auth, GitHub OAuth, or any provider besides Google**
- **NO admin panel, payment system, social features (follows/likes)**
- **NO loading.tsx/error.tsx/not-found.tsx for every route** — only where explicitly needed
- **NO utility abstractions or helper libraries** unless code duplicated 3+ times
- **NO JSDoc comments, verbose logging, README files beyond what's requested
- **NO animations/transitions/micro-interactions unless explicitly in task
- **NO "flexible/extensible" patterns** (no provider pattern for single provider, no abstract base classes)
- **NO console.log debug statements in committed code**

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: NO
- **Framework**: none
- **QA Policy**: Agent-executed QA scenarios for every task

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields
- **Build**: `pnpm build` must pass after every task

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — start immediately):
├── Task 1: Project foundation (Prisma, shadcn/ui, env, deps) [quick]
└── Task 2: better-auth setup (Google OAuth + Prisma adapter) [deep]
    NOTE: T2 depends on T1 (Prisma must be initialized first)
    These run SEQUENTIALLY: T1 → T2

Wave 2 (Schema + Core API — after auth):
├── Task 3: Prisma schema (Book, Review, Character, GeneratedImage) [quick]
├── Task 4: App layout shell + navigation + dark mode [visual-engineering]
    NOTE: T3 and T4 are independent, run in PARALLEL

Wave 3 (Features — after schema):
├── Task 5: Google Books search API + UI [unspecified-high]
├── Task 6: Book detail page [visual-engineering]
├── Task 7: Reviews CRUD (server actions + UI) [unspecified-high]
    NOTE: T5, T6, T7 can start after T3+T4. T6 depends on T5 (search provides book data)
    T5 first, then T6+T7 in parallel

Wave 4 (AI Features — after book+reviews):
├── Task 8: Character management (AI suggestion + manual CRUD) [deep]
├── Task 9: OpenAI image generation + Vercel Blob [deep]
├── Task 10: Image gallery + search [visual-engineering]
    NOTE: T8 first (characters needed for image gen), T9 after T8, T10 after T9

Wave 5 (Polish + Final):
├── Task 11: Auth guards (proxy.ts) + protected routes + UX polish [unspecified-high]

Wave FINAL (Verification — after ALL tasks):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
├── Task F3: Real manual QA [unspecified-high]
└── Task F4: Scope fidelity check [deep]
→ Present results → Get explicit user okay
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| T1 | — | T2, T3, T4, all | 1 |
| T2 | T1 | T5-T11, all auth-dependent | 1 |
| T3 | T1 | T5, T6, T7, T8, T9, T10 | 2 |
| T4 | T1 | T6, T7, T10, T11 | 2 |
| T5 | T2, T3 | T6 | 3 |
| T6 | T5, T4 | T7, T8, T9 | 3 |
| T7 | T3, T4, T6 | — | 3 |
| T8 | T3, T6 | T9 | 4 |
| T9 | T8, T2 | T10 | 4 |
| T10 | T9, T4 | T11 | 4 |
| T11 | T2, T4, T10 | F1-F4 | 5 |
| F1-F4 | ALL | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: T1 → `quick`, T2 → `deep` (load_skills: `prisma-database-setup`)
- **Wave 2**: T3 → `quick` (load_skills: `prisma-database-setup`), T4 → `visual-engineering`
- **Wave 3**: T5 → `unspecified-high`, T6 → `visual-engineering`, T7 → `unspecified-high`
- **Wave 4**: T8 → `deep`, T9 → `deep`, T10 → `visual-engineering`
- **Wave 5**: T11 → `unspecified-high`
- **FINAL**: F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high` (load_skills: `playwright`), F4 → `deep`

---

## TODOs

- [x] 1. Project Foundation — Prisma, shadcn/ui, Environment, Dependencies

  **What to do**:
  - Read `node_modules/next/dist/docs/01-app/01-getting-started/` to understand Next.js 16 conventions BEFORE writing any code
  - Initialize Prisma: `pnpm add prisma @prisma/client && npx prisma init` — configure `datasource` for PostgreSQL (Neon)
  - Create `lib/db.ts` with Prisma Client singleton pattern (globalThis for hot reload safety)
  - Create `.env` with `DATABASE_URL` (Neon connection string placeholder), `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`
  - Create `.env.example` with all env vars (values blanked)
  - Initialize shadcn/ui: `pnpm dlx shadcn@latest init` — select Tailwind v4, leave tailwind.config BLANK
  - Install core shadcn components: `pnpm dlx shadcn@latest add button card input label avatar dialog form textarea select badge tabs separator skeleton`
  - Install additional deps: `pnpm add react-hook-form zod @hookform/resolvers next-themes @vercel/blob openai`
  - Configure `next.config.ts` with `images.remotePatterns` for `books.google.com`, `books.googleusercontent.com`, and `*.public.blob.vercel-storage.com`
  - Update `app/globals.css` to include `@custom-variant dark (&:is(.dark *))` for dark mode support (Tailwind v4)
  - Verify `pnpm build` passes

  **Must NOT do**:
  - Do NOT create `tailwind.config.js/ts` — Tailwind v4 uses CSS-first config
  - Do NOT use `images.domains` in next.config — use `images.remotePatterns`
  - Do NOT add webpack configuration — Turbopack is default
  - Do NOT install better-auth yet (that's Task 2)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Configuration and dependency installation, no complex logic
  - **Skills**: [`prisma-database-setup`]
    - `prisma-database-setup`: Guides Prisma initialization and PostgreSQL setup correctly
  - **Skills Evaluated but Omitted**:
    - `vercel-react-best-practices`: Not needed for foundation setup, more relevant for component work

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (sequential with T2)
  - **Blocks**: T2, T3, T4, and all subsequent tasks
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `app/globals.css` — Current Tailwind v4 setup with `@theme inline` block; add `@custom-variant dark` here
  - `next.config.ts` — Currently empty config object; add `images.remotePatterns` here
  - `postcss.config.mjs` — Already configured with `@tailwindcss/postcss`; do NOT modify
  - `tsconfig.json:21-23` — Path alias `@/*` → `./*`; Prisma client and lib files must use this alias

  **API/Type References**:
  - `package.json` — Current deps: next 16.2.1, react 19.2.4, tailwindcss ^4; use `pnpm` for all installs

  **External References**:
  - `node_modules/next/dist/docs/` — MUST read Next.js 16 docs before writing any code (AGENTS.md directive)
  - Prisma docs: https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/relational-databases-typescript-postgresql
  - shadcn/ui init: https://ui.shadcn.com/docs/installation/next

  **WHY Each Reference Matters**:
  - `globals.css`: shadcn init may modify this file; verify `@theme inline` block is preserved and `@custom-variant dark` added
  - `next.config.ts`: Without `remotePatterns`, Google Books cover images and Vercel Blob URLs will fail to load via `next/image`
  - `tsconfig.json`: All imports must use `@/` prefix; Prisma generated client path must be accessible via this alias

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Foundation dependencies installed correctly
    Tool: Bash
    Preconditions: Clean project state
    Steps:
      1. Run `pnpm build` — should complete without errors
      2. Run `ls prisma/schema.prisma` — file should exist
      3. Run `ls lib/db.ts` — Prisma singleton file should exist
      4. Run `ls .env.example` — should list all required env vars
      5. Run `ls components/ui/button.tsx` — shadcn button component should exist
      6. Run `cat next.config.ts | grep remotePatterns` — should contain remotePatterns config
      7. Run `cat app/globals.css | grep "@custom-variant dark"` — should contain dark mode variant
    Expected Result: All files exist, build passes, configurations correct
    Failure Indicators: Build fails, missing files, missing config entries
    Evidence: .sisyphus/evidence/task-1-foundation-build.txt

  Scenario: shadcn/ui components available
    Tool: Bash
    Preconditions: shadcn init completed
    Steps:
      1. Run `ls components/ui/` — should list button, card, input, dialog, form, tabs, etc.
      2. Run `cat components.json` — should show tailwindCss config without tailwind.config path
      3. Run `pnpm build` — verify components compile correctly
    Expected Result: 12+ UI component files exist, components.json properly configured
    Failure Indicators: Missing components, components.json has tailwind.config path set
    Evidence: .sisyphus/evidence/task-1-shadcn-components.txt

  Scenario: Environment configuration correct
    Tool: Bash
    Preconditions: .env.example created
    Steps:
      1. Run `cat .env.example` — should contain DATABASE_URL, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, BLOB_READ_WRITE_TOKEN
      2. Verify `.env` is in `.gitignore`
    Expected Result: All 6 env vars present in .env.example, .env gitignored
    Failure Indicators: Missing env vars, .env not in gitignore
    Evidence: .sisyphus/evidence/task-1-env-config.txt
  ```

  **Commit**: YES
  - Message: `chore(foundation): initialize prisma, shadcn/ui, env config, dependencies`
  - Files: `prisma/schema.prisma`, `lib/db.ts`, `components.json`, `components/ui/*`, `next.config.ts`, `app/globals.css`, `.env.example`, `package.json`, `pnpm-lock.yaml`
  - Pre-commit: `pnpm build`

- [x] 2. Authentication — better-auth with Google OAuth + Prisma Adapter (ОТДЕЛЬНЫЙ ПУНКТ)

  **What to do**:
  - Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` for Next.js 16 route handler conventions
  - Install better-auth: `pnpm add better-auth`
  - Create `lib/auth.ts` — server-side auth config:
    ```
    betterAuth({
      database: prismaAdapter(prisma, { provider: "postgresql" }),
      socialProviders: { google: { clientId, clientSecret } },
      trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
    })
    ```
  - Create `lib/auth-client.ts` — client-side auth: `createAuthClient({ baseURL: process.env.NEXT_PUBLIC_APP_URL })`
  - Create catch-all API route: `app/api/auth/[...all]/route.ts` using `toNextJsHandler(auth)`. VERIFY that Next.js 16 async params work correctly with `toNextJsHandler`. If they don't, create a thin wrapper that awaits params before delegating.
  - Add better-auth required models to `prisma/schema.prisma`: `User`, `Session`, `Account`, `Verification` with exact fields per better-auth docs. Use `@@map("user")` etc for table naming.
  - Run `npx prisma migrate dev --name add-auth-tables` to create migration
  - Run `npx prisma generate` to update client
  - Create `app/(auth)/login/page.tsx` — login page with "Sign in with Google" button using `authClient.signIn.social({ provider: "google" })`
  - Create `app/(auth)/layout.tsx` — minimal centered layout for auth pages
  - Add `NEXT_PUBLIC_APP_URL=http://localhost:3000` to `.env` and `.env.example`

  **Must NOT do**:
  - Do NOT add email/password auth or any provider besides Google
  - Do NOT create `middleware.ts` — Next.js 16 uses `proxy.ts` (added in Task 11)
  - Do NOT use synchronous `cookies()` or `headers()` — always `await`
  - Do NOT create a full user profile page

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Auth integration requires careful handling of Next.js 16 async APIs, Prisma adapter setup, and potential compatibility issues with better-auth + Next.js 16
  - **Skills**: [`prisma-database-setup`]
    - `prisma-database-setup`: Guides Prisma schema creation and migration for better-auth tables
  - **Skills Evaluated but Omitted**:
    - `vercel-react-best-practices`: Auth pages are simple; no performance optimization needed here

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T1)
  - **Parallel Group**: Wave 1 (sequential: after T1)
  - **Blocks**: T5, T6, T7, T8, T9, T10, T11 (all auth-dependent features)
  - **Blocked By**: T1 (needs Prisma, env vars)

  **References**:

  **Pattern References**:
  - `lib/db.ts` (from T1) — Prisma singleton; import this in auth.ts for adapter
  - `app/globals.css` — CSS variables for theming; auth pages should use same theme

  **API/Type References**:
  - better-auth Prisma adapter tables: User (id, name, email, emailVerified, image, createdAt, updatedAt), Session (id, expiresAt, token, createdAt, updatedAt, ipAddress, userAgent, userId), Account (id, accountId, providerId, userId, accessToken, refreshToken, idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt), Verification (id, identifier, value, expiresAt, createdAt, updatedAt)
  - better-auth API: `toNextJsHandler(auth)` exports { GET, POST } for route handler
  - better-auth client: `createAuthClient()` returns `{ signIn, signOut, useSession, ... }`

  **External References**:
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — Next.js 16 route handler params are async
  - better-auth Next.js integration: https://better-auth.com/docs/integrations/next
  - better-auth Prisma adapter: https://better-auth.com/docs/adapters/prisma
  - Google OAuth setup: https://better-auth.com/docs/authentication/social#google

  **WHY Each Reference Matters**:
  - `lib/db.ts`: Auth MUST use the same Prisma singleton to avoid connection exhaustion
  - Route handler docs: Next.js 16 made params async — `toNextJsHandler` may need a wrapper to handle this
  - better-auth Prisma tables: Exact field names and types MUST match or auth will fail silently

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Auth API route responds correctly
    Tool: Bash (curl)
    Preconditions: Dev server running (`pnpm dev`)
    Steps:
      1. Run `curl -s http://localhost:3000/api/auth/get-session` — should return JSON
      2. Check response body contains `"session":null` (no active session)
      3. Run `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/get-session` — should return 200
    Expected Result: Status 200, body contains `{"session":null}`
    Failure Indicators: 404 (route not found), 500 (async params issue), malformed JSON
    Evidence: .sisyphus/evidence/task-2-auth-api.txt

  Scenario: Login page renders with Google OAuth button
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Navigate to `http://localhost:3000/login`
      2. Wait for page to load (timeout: 10s)
      3. Assert element exists: `button:has-text("Google")` or `button:has-text("Sign in with Google")`
      4. Click the Google sign-in button
      5. Assert URL changes to contain `accounts.google.com` (OAuth redirect)
    Expected Result: Login page loads, Google button visible, clicking redirects to Google OAuth
    Failure Indicators: Page 404, no button found, no redirect
    Evidence: .sisyphus/evidence/task-2-login-page.png

  Scenario: Prisma auth tables created correctly
    Tool: Bash
    Preconditions: Migration completed
    Steps:
      1. Run `npx prisma migrate status` — should show all migrations applied
      2. Run `npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"` — should list user, session, account, verification tables
    Expected Result: 4 auth tables exist in database
    Failure Indicators: Missing tables, migration pending, connection error
    Evidence: .sisyphus/evidence/task-2-auth-tables.txt

  Scenario: Build succeeds with auth setup
    Tool: Bash
    Preconditions: All auth files created
    Steps:
      1. Run `pnpm build` — should complete without errors
    Expected Result: Build successful
    Failure Indicators: TypeScript errors, import resolution failures, Turbopack errors
    Evidence: .sisyphus/evidence/task-2-build.txt
  ```

  **Commit**: YES
  - Message: `feat(auth): implement better-auth with Google OAuth and Prisma adapter`
  - Files: `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`, `app/(auth)/login/page.tsx`, `app/(auth)/layout.tsx`, `prisma/schema.prisma`, `prisma/migrations/*`
  - Pre-commit: `pnpm build`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] 3. Prisma Schema — Book, Review, Character, GeneratedImage Models

  **What to do**:
  - Add application models to `prisma/schema.prisma` (after better-auth models from T2):
    - **Book**: id (cuid), googleBooksId (String, @unique), title, authors (String — comma-separated or JSON), description (Text, optional), thumbnailUrl (optional), language (optional), publishedDate (optional), createdAt, updatedAt. Index on googleBooksId, title.
    - **Review**: id (cuid), rating (Int, 1-5), title (optional), content (Text, optional), createdAt, updatedAt. Relations: userId → User, bookId → Book. Unique constraint on (userId, bookId). Index on bookId+createdAt.
    - **Character**: id (cuid), name, description (Text, optional), bookId → Book, createdById → User, createdAt. Index on bookId, name.
    - **GeneratedImage**: id (cuid), prompt (Text), blobUrl (String), createdAt. Relations: userId → User, bookId → Book, characterId → Character (optional). Index on bookId, characterId, userId.
  - Run `npx prisma migrate dev --name add-app-models`
  - Run `npx prisma generate`
  - Verify all relations are correct with `npx prisma validate`

  **Must NOT do**:
  - Do NOT modify better-auth models (User, Session, Account, Verification) — only ADD relations to User
  - Do NOT create API routes or pages — schema only
  - Do NOT add overly complex models (tags, categories, etc.)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Schema definition is straightforward, no complex logic
  - **Skills**: [`prisma-database-setup`]
    - `prisma-database-setup`: Ensures correct Prisma schema patterns, relations, and migration workflow

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T4)
  - **Parallel Group**: Wave 2 (with T4)
  - **Blocks**: T5, T6, T7, T8, T9, T10
  - **Blocked By**: T2 (needs auth models in schema)

  **References**:

  **Pattern References**:
  - `prisma/schema.prisma` (after T2) — Contains better-auth models; add new models BELOW them, add relations to User model

  **API/Type References**:
  - Book model: `googleBooksId` is the unique identifier from Google Books API `volumeInfo.id`
  - Review: `@@unique([userId, bookId])` ensures one review per user per book
  - GeneratedImage: `characterId` is optional — images can be for entire book (no character)
  - Character: `createdById` tracks who added the character; characters are shared globally per book

  **External References**:
  - Prisma relations: https://www.prisma.io/docs/orm/prisma-schema/data-model/relations
  - Prisma indexes: https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes

  **WHY Each Reference Matters**:
  - `prisma/schema.prisma`: MUST add relations to existing User model without breaking better-auth fields
  - Unique constraints prevent duplicate reviews and ensure data integrity

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Schema validates and migrates successfully
    Tool: Bash
    Preconditions: T2 auth tables exist
    Steps:
      1. Run `npx prisma validate` — should output "Prisma schema is valid"
      2. Run `npx prisma migrate status` — should show all migrations applied
      3. Run `npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"` — should list book, character, generated_image, review (plus auth tables)
    Expected Result: 8+ tables exist (4 auth + 4 app), schema valid
    Failure Indicators: Validation errors, migration failures, missing tables
    Evidence: .sisyphus/evidence/task-3-schema-validation.txt

  Scenario: Relations and constraints correct
    Tool: Bash
    Preconditions: Migration applied
    Steps:
      1. Run `npx prisma db execute --stdin <<< "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='review' AND constraint_type='UNIQUE';"` — should show userId_bookId unique constraint
      2. Run `pnpm build` — should compile with generated Prisma client types
    Expected Result: Unique constraint exists, build passes with correct types
    Failure Indicators: Missing constraints, TypeScript type errors from Prisma client
    Evidence: .sisyphus/evidence/task-3-relations.txt
  ```

  **Commit**: YES
  - Message: `feat(db): add Book, Review, Character, GeneratedImage models and migration`
  - Files: `prisma/schema.prisma`, `prisma/migrations/*`
  - Pre-commit: `pnpm build`

- [ ] 4. App Layout Shell — Navigation, Dark Mode, Theme Provider

  **What to do**:
  - Read `node_modules/next/dist/docs/01-app/01-getting-started/` for layout conventions in Next.js 16
  - Create `components/theme-provider.tsx` — wraps `next-themes` ThemeProvider (`"use client"`, attribute="class", defaultTheme="system", enableSystem)
  - Update `app/layout.tsx`:
    - Wrap children with `<ThemeProvider>`
    - Add `suppressHydrationWarning` to `<html>` tag
    - Update `<html lang="en">` to include dark class support
    - Keep existing Geist fonts
    - Update metadata: title="Books Reviews", description="Search books, leave reviews, generate AI illustrations"
  - Create `app/(main)/layout.tsx` — authenticated layout with:
    - Header/navbar with: logo/app name, search link, gallery link, dark mode toggle, user avatar (from session) + sign out button
    - Use shadcn components: `Button`, `Avatar`, `Separator`
    - Import `authClient.useSession()` for user info display (this is a client component for the nav)
  - Create `components/dark-mode-toggle.tsx` — toggle button using `useTheme()` from next-themes, sun/moon icons
  - Create `components/user-nav.tsx` — client component showing user avatar + dropdown with sign out
  - Ensure responsive design: hamburger menu on mobile for nav items

  **Must NOT do**:
  - Do NOT add loading.tsx/error.tsx/not-found.tsx for every route
  - Do NOT add animations or transitions
  - Do NOT create full page content — just the shell/layout structure
  - Do NOT add auth guards in layout (that's Task 11 with proxy.ts)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Layout, navigation, dark mode, responsive design — all visual/frontend concerns
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: Ensures correct React 19 patterns, proper client/server component boundaries
  - **Skills Evaluated but Omitted**:
    - `prisma-database-setup`: No database work in this task

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T3)
  - **Parallel Group**: Wave 2 (with T3)
  - **Blocks**: T6, T7, T10, T11
  - **Blocked By**: T1 (needs shadcn/ui components, next-themes, globals.css)

  **References**:

  **Pattern References**:
  - `app/layout.tsx` — Current root layout with Geist fonts; update this file, keep font setup
  - `app/globals.css` — Has `@theme inline` + `@custom-variant dark`; verify dark mode CSS variables
  - `lib/auth-client.ts` (from T2) — Import `useSession` for user nav component
  - `components/ui/button.tsx` (from T1) — shadcn Button for nav items
  - `components/ui/avatar.tsx` (from T1) — shadcn Avatar for user profile display

  **External References**:
  - next-themes: https://github.com/pacocoursey/next-themes — ThemeProvider setup for App Router
  - shadcn/ui dark mode: https://ui.shadcn.com/docs/dark-mode/next

  **WHY Each Reference Matters**:
  - `app/layout.tsx`: Must preserve existing font setup while adding ThemeProvider
  - `lib/auth-client.ts`: Nav component needs `useSession()` to show avatar/name and sign out button
  - Dark mode docs: Tailwind v4 uses different approach than v3 for dark mode

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Layout renders with navigation
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user NOT authenticated
    Steps:
      1. Navigate to `http://localhost:3000`
      2. Assert header/navbar exists: `header` or `nav` element visible
      3. Assert app name/logo visible in header
      4. Assert dark mode toggle button exists
      5. Assert "Sign in" or login link visible (user not authenticated)
    Expected Result: Layout shell renders with nav, dark mode toggle, login link
    Failure Indicators: Blank page, missing nav, hydration errors
    Evidence: .sisyphus/evidence/task-4-layout-light.png

  Scenario: Dark mode toggle works
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Navigate to `http://localhost:3000`
      2. Take screenshot (light mode)
      3. Click dark mode toggle button
      4. Wait 500ms for theme transition
      5. Assert `html` element has class `dark`
      6. Take screenshot (dark mode)
      7. Compare: background color should be different between screenshots
    Expected Result: Dark class added to html, visual theme changes
    Failure Indicators: No class change, no visual difference, JS error
    Evidence: .sisyphus/evidence/task-4-dark-mode.png

  Scenario: Build succeeds with layout
    Tool: Bash
    Preconditions: All layout files created
    Steps:
      1. Run `pnpm build` — should complete without errors
    Expected Result: Build successful
    Failure Indicators: Client/server component boundary errors, import issues
    Evidence: .sisyphus/evidence/task-4-build.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): app layout shell, navigation, dark mode, theme provider`
  - Files: `app/layout.tsx`, `app/(main)/layout.tsx`, `components/theme-provider.tsx`, `components/dark-mode-toggle.tsx`, `components/user-nav.tsx`
  - Pre-commit: `pnpm build`

- [x] 5. Google Books Search — API Proxy + Search UI

  **What to do**:
  - Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` for Next.js 16 route handler conventions
  - Create `lib/google-books.ts` — utility for Google Books API:
    - Function `searchBooks(query: string, lang?: string)` — calls `https://www.googleapis.com/books/v1/volumes?q={query}&langRestrict={lang}&maxResults=20`
    - Function `getBook(volumeId: string)` — calls `https://www.googleapis.com/books/v1/volumes/{volumeId}`
    - TypeScript types for API response: `GoogleBooksVolume`, `GoogleBooksSearchResult`
    - Handle API errors gracefully (rate limit, network errors)
  - Create `app/api/books/search/route.ts` — GET handler:
    - Query params: `q` (required), `lang` (optional, default "en")
    - Uses `await searchParams` (Next.js 16 async)
    - Returns formatted results: id, title, authors, description, thumbnail, language
  - Create `app/(main)/search/page.tsx` — search page:
    - Search input with debounce (300ms) using shadcn Input
    - Language selector dropdown (English, Russian, French, German, Spanish, etc.) using shadcn Select
    - Results grid using shadcn Card components: book cover thumbnail, title, authors, short description
    - Each card links to `/book/{googleBooksId}`
    - Loading state with shadcn Skeleton
    - Empty state: "No books found" message
    - Use client-side fetch to `/api/books/search?q=...&lang=...`
  - Create server action `lib/actions/books.ts` with `saveBookToDb(googleBooksVolume)` — saves book metadata to DB on first interaction (called from book detail page, not search)

  **Must NOT do**:
  - Do NOT save books to DB during search (save on first interaction in book detail page)
  - Do NOT use synchronous `searchParams` access — use `await searchParams`
  - Do NOT add pagination to search (v1 — keep it simple with maxResults=20)
  - Do NOT create the book detail page (that's Task 6)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Involves API integration, server/client coordination, search UX
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: Ensures proper data fetching patterns, component boundaries
  - **Skills Evaluated but Omitted**:
    - `prisma-database-setup`: Only minor DB interaction (saveBookToDb action); main work is API integration

  **Parallelization**:
  - **Can Run In Parallel**: NO (starts Wave 3 first)
  - **Parallel Group**: Wave 3 (T5 first, then T6+T7 in parallel)
  - **Blocks**: T6 (book detail needs search to provide book data)
  - **Blocked By**: T2 (auth for protected routes), T3 (Book model for saveBookToDb)

  **References**:

  **Pattern References**:
  - `lib/db.ts` (from T1) — Prisma client for saveBookToDb action
  - `prisma/schema.prisma` (T3) — Book model with `googleBooksId` unique field

  **API/Type References**:
  - Google Books API search: `GET https://www.googleapis.com/books/v1/volumes?q={query}&langRestrict={lang}&maxResults=20`
  - Response: `{ items: [{ id, volumeInfo: { title, authors[], description, imageLinks: { thumbnail }, language, publishedDate } }] }`
  - Book model fields: googleBooksId, title, authors, description, thumbnailUrl, language, publishedDate

  **External References**:
  - Google Books API: https://developers.google.com/books/docs/v1/using#PerformingSearch
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — async searchParams

  **WHY Each Reference Matters**:
  - Google Books API docs: Exact endpoint, query parameters, response shape needed for TypeScript types
  - Book model: `saveBookToDb` must map Google Books fields to Prisma model correctly

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Search API returns book results in English
    Tool: Bash (curl)
    Preconditions: Dev server running
    Steps:
      1. Run `curl -s "http://localhost:3000/api/books/search?q=Harry+Potter&lang=en"` 
      2. Parse JSON response
      3. Assert response has array field (e.g., `books` or `results`)
      4. Assert first result has fields: id, title, authors, thumbnail
      5. Assert title contains "Harry Potter"
    Expected Result: JSON array with Harry Potter books, each having id, title, authors, thumbnail
    Failure Indicators: 500 error, empty results, missing fields
    Evidence: .sisyphus/evidence/task-5-search-english.txt

  Scenario: Search API works in Russian
    Tool: Bash (curl)
    Preconditions: Dev server running
    Steps:
      1. Run `curl -s "http://localhost:3000/api/books/search?q=%D0%92%D0%BE%D0%B9%D0%BD%D0%B0+%D0%B8+%D0%BC%D0%B8%D1%80&lang=ru"` (URL-encoded "Война и мир")
      2. Parse JSON response
      3. Assert response contains results
      4. Assert at least one result title contains Cyrillic characters
    Expected Result: Russian-language book results returned
    Failure Indicators: Empty results, only English results
    Evidence: .sisyphus/evidence/task-5-search-russian.txt

  Scenario: Search UI renders and functions
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user authenticated
    Steps:
      1. Navigate to `http://localhost:3000/search`
      2. Assert search input exists: `input[type="text"]` or `input[placeholder*="search" i]`
      3. Assert language selector exists: `select` or shadcn Select component
      4. Type "Harry Potter" in search input
      5. Wait 1s for debounced results
      6. Assert result cards appear: at least 1 card with book title visible
      7. Take screenshot
    Expected Result: Search page loads, typing shows book results in card grid
    Failure Indicators: No input, no results after typing, JS errors
    Evidence: .sisyphus/evidence/task-5-search-ui.png
  ```

  **Commit**: YES
  - Message: `feat(search): Google Books API search with multilingual support`
  - Files: `lib/google-books.ts`, `app/api/books/search/route.ts`, `app/(main)/search/page.tsx`, `lib/actions/books.ts`
  - Pre-commit: `pnpm build`

- [x] 6. Book Detail Page — Metadata, Save to DB, Tabs Structure

  **What to do**:
  - Create `app/(main)/book/[id]/page.tsx` — dynamic book detail page:
    - `[id]` = googleBooksId from URL params (use `await params` — Next.js 16 async)
    - Server component: fetch book data from Google Books API (`getBook(id)` from `lib/google-books.ts`)
    - Save/upsert book metadata to DB on page load (server action `saveBookToDb`)
    - Display: cover image (via `next/image` with remotePatterns), title, authors, description, published date, language
    - Tabs structure using shadcn Tabs: "Reviews" tab, "Characters" tab, "AI Images" tab
    - Tab content will be placeholder slots (actual content in T7, T8, T9)
  - Create `app/(main)/book/[id]/layout.tsx` — layout for book detail with book header always visible
  - Style with shadcn Card, Badge (for language), Tabs components

  **Must NOT do**:
  - Do NOT implement reviews tab content (Task 7)
  - Do NOT implement characters tab content (Task 8)
  - Do NOT implement AI images tab content (Tasks 9-10)
  - Do NOT use synchronous `params` — use `const { id } = await params`

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Book detail page is primarily visual — layout, cover display, tabs structure
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: Ensures correct server component data fetching, image optimization

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T7 after T5 completes, but T6 should complete before T7 starts to provide page structure)
  - **Parallel Group**: Wave 3 (after T5)
  - **Blocks**: T7, T8, T9
  - **Blocked By**: T5 (needs google-books.ts utilities), T4 (needs layout shell)

  **References**:

  **Pattern References**:
  - `lib/google-books.ts` (from T5) — `getBook(volumeId)` function for fetching book data
  - `lib/actions/books.ts` (from T5) — `saveBookToDb()` server action for persisting to DB
  - `next.config.ts` (from T1) — `remotePatterns` for Google Books cover images
  - `components/ui/tabs.tsx` (from T1) — shadcn Tabs for Reviews/Characters/Images sections

  **API/Type References**:
  - Google Books single volume: `GET https://www.googleapis.com/books/v1/volumes/{volumeId}`
  - Book model: googleBooksId, title, authors, description, thumbnailUrl

  **External References**:
  - `node_modules/next/dist/docs/01-app/01-getting-started/08-dynamic-routes.md` — Next.js 16 async params

  **WHY Each Reference Matters**:
  - `lib/google-books.ts`: Book detail fetches from Google Books API, must reuse same utility
  - Async params docs: `const { id } = await params` is MANDATORY in Next.js 16

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Book detail page renders with metadata
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user authenticated
    Steps:
      1. Navigate to `http://localhost:3000/book/zyTCAlFPjgYC` (known Google Books ID for "The Great Gatsby")
      2. Wait for page load (timeout: 10s)
      3. Assert page title or heading contains book name
      4. Assert cover image is visible: `img[alt*="cover" i]` or `img` within book detail section
      5. Assert author name visible on page
      6. Assert tabs exist: text "Reviews", "Characters", "Images" visible
      7. Take screenshot
    Expected Result: Book page shows cover, title, author, description, and 3 tabs
    Failure Indicators: 404, blank page, missing cover, no tabs
    Evidence: .sisyphus/evidence/task-6-book-detail.png

  Scenario: Book saved to database on visit
    Tool: Bash
    Preconditions: Dev server running, book page visited via Playwright
    Steps:
      1. Run `npx prisma db execute --stdin <<< "SELECT google_books_id, title FROM book LIMIT 5;"` 
      2. Assert at least one book row exists in the table
    Expected Result: Book metadata persisted in DB after page visit
    Failure Indicators: Empty table, connection error
    Evidence: .sisyphus/evidence/task-6-book-db.txt
  ```

  **Commit**: YES
  - Message: `feat(book): book detail page with metadata from Google Books`
  - Files: `app/(main)/book/[id]/page.tsx`, `app/(main)/book/[id]/layout.tsx`
  - Pre-commit: `pnpm build`

- [x] 7. Reviews CRUD — Star Rating, Server Actions, UI Components

  **What to do**:
  - Read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` for Server Action patterns in Next.js 16
  - Create server actions in `lib/actions/reviews.ts`:
    - `createReview(bookId, { rating, title, content })` — validates auth, validates input with zod (rating 1-5, content min 10 chars), creates review, `revalidatePath`
    - `updateReview(reviewId, { rating, title, content })` — validates auth + ownership, updates, `revalidatePath`
    - `deleteReview(reviewId)` — validates auth + ownership, deletes, `revalidatePath`
    - `getBookReviews(bookId)` — fetches reviews with user info (name, image), ordered by createdAt DESC
  - Create `components/review-form.tsx` — client component:
    - Star rating selector (1-5 clickable stars using shadcn Button or custom star component)
    - Title input (optional) using shadcn Input
    - Content textarea using shadcn Textarea
    - Submit button with loading state
    - Uses react-hook-form + zod for validation
    - If user already reviewed this book, pre-fill form for editing
  - Create `components/review-card.tsx` — server component:
    - Displays: user avatar + name, star rating (filled/empty stars), review title, content, date
    - Edit/Delete buttons shown only if current user is the author
    - Uses shadcn Card, Avatar, Button
  - Create `components/review-list.tsx` — renders list of ReviewCard components
  - Integrate reviews into book detail page: populate "Reviews" tab content in `app/(main)/book/[id]/page.tsx`
  - Show average rating and review count on book detail header

  **Must NOT do**:
  - Do NOT allow multiple reviews per user per book (unique constraint enforced)
  - Do NOT add pagination (v1 — show all reviews)
  - Do NOT add likes/upvotes on reviews
  - Do NOT use synchronous request APIs

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Full CRUD with server actions, form validation, client/server component coordination
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: Server Actions patterns, form handling, revalidation

  **Parallelization**:
  - **Can Run In Parallel**: YES (can start once T6 is done, parallel with nothing in practice)
  - **Parallel Group**: Wave 3 (after T6)
  - **Blocks**: None directly
  - **Blocked By**: T3 (Review model), T4 (layout), T6 (book detail page structure)

  **References**:

  **Pattern References**:
  - `app/(main)/book/[id]/page.tsx` (from T6) — Add reviews tab content here
  - `lib/db.ts` (from T1) — Prisma client for DB queries
  - `lib/auth.ts` (from T2) — `auth.api.getSession({ headers: await headers() })` for auth validation in server actions
  - `prisma/schema.prisma` (T3) — Review model with unique(userId, bookId)

  **API/Type References**:
  - Review model: id, rating (Int 1-5), title (optional), content (Text), userId, bookId, createdAt, updatedAt
  - Zod schema: `z.object({ rating: z.number().min(1).max(5), title: z.string().optional(), content: z.string().min(10) })`

  **External References**:
  - `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` — Server Actions + revalidatePath
  - react-hook-form + shadcn: https://ui.shadcn.com/docs/components/form

  **WHY Each Reference Matters**:
  - Server Actions docs: Must use `'use server'` directive, validate auth INSIDE each action
  - Review model: Unique constraint means create should handle "already exists" by switching to edit mode

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Create a book review
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user authenticated, on book detail page
    Steps:
      1. Navigate to book detail page (e.g., `/book/zyTCAlFPjgYC`)
      2. Click "Reviews" tab
      3. Find review form (star rating + textarea)
      4. Click 4th star (rating = 4)
      5. Type "Great classic novel" in title input
      6. Type "This book is a masterpiece of American literature. Fitzgerald captures the essence of the Jazz Age." in content textarea
      7. Click submit button
      8. Wait for form submission (timeout: 5s)
      9. Assert new review card appears with rating 4, title "Great classic novel", and content text
      10. Assert user avatar/name shown on review
    Expected Result: Review created and displayed in reviews list
    Failure Indicators: Form validation error, 500 error, review not appearing
    Evidence: .sisyphus/evidence/task-7-create-review.png

  Scenario: Duplicate review prevented (edit mode)
    Tool: Playwright (playwright skill)
    Preconditions: User already has a review for this book
    Steps:
      1. Navigate to same book detail page
      2. Click "Reviews" tab
      3. Assert form is pre-filled with existing review data (rating, title, content)
      4. Change rating to 5
      5. Submit form
      6. Assert review updated (not duplicated) — still only one review from this user
    Expected Result: Existing review updated, not a new one created
    Failure Indicators: Duplicate review created, form not pre-filled
    Evidence: .sisyphus/evidence/task-7-edit-review.png

  Scenario: Review API validation
    Tool: Bash (curl)
    Preconditions: Dev server running, valid session cookie
    Steps:
      1. Attempt to create review with rating 0 — should fail validation
      2. Attempt to create review with content "short" (< 10 chars) — should fail validation
    Expected Result: Validation errors returned for invalid input
    Failure Indicators: 500 error instead of validation error, review created with invalid data
    Evidence: .sisyphus/evidence/task-7-validation.txt
  ```

  **Commit**: YES
  - Message: `feat(reviews): reviews CRUD with star rating and server actions`
  - Files: `lib/actions/reviews.ts`, `components/review-form.tsx`, `components/review-card.tsx`, `components/review-list.tsx`, `app/(main)/book/[id]/page.tsx` (updated)
  - Pre-commit: `pnpm build`

- [x] 8. Character Management — AI Extraction + Manual CRUD

  **What to do**:
  - Create `lib/openai.ts` — OpenAI client singleton:
    - Initialize `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`
    - Function `extractCharacters(bookTitle: string, bookDescription: string): Promise<{name: string, description: string}[]>` — uses OpenAI chat completion (gpt-4o-mini for cost efficiency) with structured prompt:
      ```
      "Given this book titled '{title}' with description: '{description}', extract a list of main characters. Return JSON array with {name, description} for each character. If no characters can be identified, return empty array."
      ```
    - Parse JSON response, validate structure, return typed array
  - Create server actions in `lib/actions/characters.ts`:
    - `suggestCharacters(bookId)` — fetches book from DB, calls `extractCharacters()`, returns suggestions (does NOT save to DB yet)
    - `addCharacter(bookId, { name, description })` — validates auth, creates Character in DB, `revalidatePath`
    - `updateCharacter(characterId, { name, description })` — validates auth + creator ownership, updates
    - `deleteCharacter(characterId)` — validates auth + creator ownership, deletes
    - `getBookCharacters(bookId)` — fetches all characters for a book with creator info
  - Create `components/character-card.tsx` — displays character: name, description, "Generate Image" button, edit/delete for creator
  - Create `components/character-form.tsx` — client component:
    - Input for character name, textarea for description
    - Uses react-hook-form + zod validation
  - Create `components/character-suggestions.tsx` — client component:
    - "Suggest Characters with AI" button (triggers `suggestCharacters` action)
    - Loading state while AI processes
    - Shows suggestion cards with "Add" button to save each to DB
    - User can dismiss suggestions they don't want
  - Integrate into book detail page: populate "Characters" tab in `app/(main)/book/[id]/page.tsx`
    - List existing characters (CharacterCard)
    - "Add Character" form (manual)
    - "Suggest with AI" button (AI extraction)

  **Must NOT do**:
  - Do NOT use GPT-4 for character extraction (use gpt-4o-mini for cost)
  - Do NOT auto-save AI suggestions — user must explicitly "Add" each one
  - Do NOT implement image generation here (Task 9)
  - Do NOT duplicate characters — check by name+bookId before adding

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: OpenAI integration, AI prompt engineering, complex state management for suggestions flow
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `prisma-database-setup`: Simple CRUD operations, no schema changes needed
    - `vercel-react-best-practices`: Client component state is straightforward

  **Parallelization**:
  - **Can Run In Parallel**: NO (starts Wave 4)
  - **Parallel Group**: Wave 4 (T8 → T9 → T10 sequential)
  - **Blocks**: T9 (image gen needs characters)
  - **Blocked By**: T3 (Character model), T6 (book detail page)

  **References**:

  **Pattern References**:
  - `app/(main)/book/[id]/page.tsx` (from T6) — Add characters tab content here
  - `lib/db.ts` (from T1) — Prisma client for character CRUD
  - `lib/auth.ts` (from T2) — Auth validation in server actions
  - `prisma/schema.prisma` (T3) — Character model: id, name, description, bookId, createdById

  **API/Type References**:
  - OpenAI Chat Completion: `openai.chat.completions.create({ model: "gpt-4o-mini", messages: [...], response_format: { type: "json_object" } })`
  - Character model: name (String), description (Text optional), bookId → Book, createdById → User

  **External References**:
  - OpenAI Chat API: https://platform.openai.com/docs/guides/text-generation
  - OpenAI JSON mode: https://platform.openai.com/docs/guides/structured-outputs

  **WHY Each Reference Matters**:
  - OpenAI JSON mode ensures reliable structured output for character extraction
  - Character model: `createdById` determines who can edit/delete, but characters are visible to ALL users

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: AI character suggestions work
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user authenticated, on book detail page with description
    Steps:
      1. Navigate to book detail page (e.g., `/book/zyTCAlFPjgYC` — The Great Gatsby)
      2. Click "Characters" tab
      3. Click "Suggest Characters with AI" button
      4. Wait for AI response (timeout: 30s — AI can be slow)
      5. Assert suggestion cards appear with character names (e.g., "Jay Gatsby", "Nick Carraway")
      6. Assert each suggestion has an "Add" button
      7. Click "Add" on first suggestion
      8. Assert character now appears in the characters list (not suggestions)
    Expected Result: AI suggests characters, user can add them individually
    Failure Indicators: No suggestions, timeout, suggestions saved without user action
    Evidence: .sisyphus/evidence/task-8-ai-suggestions.png

  Scenario: Manual character creation
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user authenticated, on Characters tab
    Steps:
      1. Find "Add Character" form
      2. Type "Daisy Buchanan" in name input
      3. Type "A beautiful and wealthy young woman, Nick's cousin" in description
      4. Click submit/add button
      5. Assert character card "Daisy Buchanan" appears in the list
    Expected Result: Character created and displayed
    Failure Indicators: Form error, character not appearing
    Evidence: .sisyphus/evidence/task-8-manual-character.png

  Scenario: Character deletion by creator
    Tool: Playwright (playwright skill)
    Preconditions: Character created by current user exists
    Steps:
      1. Find character card created by current user
      2. Assert delete button visible
      3. Click delete button
      4. Assert character removed from list
    Expected Result: Character deleted, removed from UI
    Failure Indicators: Delete button missing, character still visible after delete
    Evidence: .sisyphus/evidence/task-8-delete-character.png
  ```

  **Commit**: YES
  - Message: `feat(characters): AI-assisted character extraction and manual CRUD`
  - Files: `lib/openai.ts`, `lib/actions/characters.ts`, `components/character-card.tsx`, `components/character-form.tsx`, `components/character-suggestions.tsx`, `app/(main)/book/[id]/page.tsx` (updated)
  - Pre-commit: `pnpm build`

- [ ] 9. OpenAI Image Generation + Vercel Blob Storage

  **What to do**:
  - Add image generation function to `lib/openai.ts` (or create `lib/image-generation.ts`):
    - Function `generateImage(prompt: string): Promise<{ base64: string, revisedPrompt: string }>`:
      - Calls `openai.images.generate({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "medium", response_format: "b64_json" })`
      - Returns base64 data + revised prompt
    - Function `buildImagePrompt(bookTitle: string, characterName?: string, characterDescription?: string, userPromptAddition?: string): string`:
      - For book: "An artistic illustration representing the book '{title}'. Style: digital art, book cover aesthetic."
      - For character: "An illustration of {characterName} from the book '{bookTitle}'. {characterDescription}. Style: digital art, character portrait."
      - Append user's additional prompt text if provided
  - Create `lib/blob-storage.ts`:
    - Function `uploadImageToBlob(base64: string, path: string): Promise<string>`:
      - Convert base64 to Buffer
      - Upload via `put(path, buffer, { access: 'public', contentType: 'image/png' })` from `@vercel/blob`
      - Return permanent blob URL
  - Create server action in `lib/actions/images.ts`:
    - `generateBookImage(bookId, { characterId?, userPrompt? })`:
      - Validate auth
      - Check per-user daily limit (max 10 generations/day — count from DB)
      - Build prompt from book/character data
      - Call `generateImage()`
      - Upload to Vercel Blob: `books/{bookId}/images/{imageId}.png` (or `books/{bookId}/characters/{characterId}/{imageId}.png`)
      - Save GeneratedImage record to DB (userId, bookId, characterId, prompt, blobUrl)
      - `revalidatePath`
      - Return the created image with blobUrl
  - Create `components/image-generator.tsx` — client component:
    - "Generate Image" button on book detail or character card
    - Optional text input for user to add prompt details
    - Loading state during generation (can take 10-30s)
    - Preview of generated image after completion
    - Error handling (API errors, rate limit exceeded)
  - Integrate into book detail page "AI Images" tab:
    - Show existing generated images for this book
    - "Generate for Book" button
    - Each character card has "Generate Image" button
  - Display generated images with: image, prompt used, creator name, date

  **Must NOT do**:
  - Do NOT use `response_format: "url"` — URLs expire in 1-2h, MUST use `b64_json`
  - Do NOT allow unlimited generations — enforce 10/user/day cap
  - Do NOT store images in DB (base64 in PostgreSQL) — use Vercel Blob
  - Do NOT use gpt-image-1-mini in production (quality too low for character art)
  - Do NOT build the gallery/search page (Task 10)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: OpenAI image API integration, Vercel Blob storage, rate limiting logic, complex async flow
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `prisma-database-setup`: Simple DB record creation, no schema changes

  **Parallelization**:
  - **Can Run In Parallel**: NO (after T8)
  - **Parallel Group**: Wave 4 (T8 → T9 → T10)
  - **Blocks**: T10 (gallery needs images)
  - **Blocked By**: T8 (needs characters + openai.ts), T2 (auth)

  **References**:

  **Pattern References**:
  - `lib/openai.ts` (from T8) — OpenAI client singleton; ADD image generation function here
  - `lib/db.ts` (from T1) — Prisma client for GeneratedImage record
  - `lib/auth.ts` (from T2) — Auth validation in server actions
  - `prisma/schema.prisma` (T3) — GeneratedImage model: id, prompt, blobUrl, userId, bookId, characterId (optional)

  **API/Type References**:
  - OpenAI Images: `openai.images.generate({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "medium", response_format: "b64_json" })`
  - Response: `{ data: [{ b64_json: string, revised_prompt: string }] }`
  - Vercel Blob: `import { put } from '@vercel/blob'` → `put(pathname, body, { access: 'public' })`
  - GeneratedImage model: prompt (Text), blobUrl (String), userId, bookId, characterId (optional)

  **External References**:
  - OpenAI Images API: https://platform.openai.com/docs/guides/images
  - Vercel Blob: https://vercel.com/docs/storage/vercel-blob
  - `@vercel/blob` API: `put(pathname, body, options)` returns `{ url, downloadUrl, pathname }`

  **WHY Each Reference Matters**:
  - OpenAI Images API: MUST use b64_json (URLs expire). Model name and parameters are critical.
  - Vercel Blob: Permanent storage for generated images. `access: 'public'` required for gallery.
  - Daily limit: Without this, costs spiral (even at $0.034/image, 1000 images = $34)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Generate image for a book
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user authenticated, on book detail page, OPENAI_API_KEY configured
    Steps:
      1. Navigate to book detail page
      2. Click "AI Images" tab
      3. Click "Generate for Book" button
      4. Wait for generation (timeout: 60s — image generation is slow)
      5. Assert generated image appears: `img[src*="blob.vercel-storage.com"]` or similar
      6. Assert prompt text displayed near image
      7. Assert creator name shown
    Expected Result: Image generated, stored in Vercel Blob, displayed with permanent URL
    Failure Indicators: Timeout, error message, image with OpenAI temp URL instead of Blob
    Evidence: .sisyphus/evidence/task-9-generate-book-image.png

  Scenario: Generate image for a character
    Tool: Playwright (playwright skill)
    Preconditions: Book has at least one character
    Steps:
      1. Navigate to book detail page "Characters" tab
      2. Find a character card
      3. Click "Generate Image" button on character card
      4. Wait for generation (timeout: 60s)
      5. Assert image appears linked to that character
    Expected Result: Character image generated and displayed
    Failure Indicators: Wrong character association, missing image
    Evidence: .sisyphus/evidence/task-9-generate-character-image.png

  Scenario: Daily limit enforced
    Tool: Bash (curl)
    Preconditions: User has reached 10 generations today (manually insert records if needed for test)
    Steps:
      1. Attempt to generate 11th image via server action
      2. Assert error response indicating daily limit reached
    Expected Result: Generation blocked with "Daily limit reached" message
    Failure Indicators: Image generated despite limit, 500 error instead of user-friendly message
    Evidence: .sisyphus/evidence/task-9-daily-limit.txt
  ```

  **Commit**: YES
  - Message: `feat(images): OpenAI image generation with Vercel Blob storage`
  - Files: `lib/openai.ts` (updated), `lib/blob-storage.ts`, `lib/actions/images.ts`, `components/image-generator.tsx`, `app/(main)/book/[id]/page.tsx` (updated)
  - Pre-commit: `pnpm build`

- [ ] 10. Image Gallery — Public Gallery with Search by Book and Character

  **What to do**:
  - Create server actions in `lib/actions/gallery.ts`:
    - `getGalleryImages({ query?, page? })` — fetches GeneratedImage records with:
      - Related book (title, thumbnailUrl) and character (name) data
      - Creator user info (name, image)
      - Search filter: if `query` provided, search across book.title, character.name (case-insensitive using Prisma `contains` with `mode: 'insensitive'`)
      - Ordered by createdAt DESC
      - Paginated: 20 images per page
    - `getBookImages(bookId)` — all images for a specific book
    - `getCharacterImages(characterId)` — all images for a specific character
  - Create `app/(main)/gallery/page.tsx` — public gallery page:
    - Search input at top (searches across book titles and character names)
    - Uses `await searchParams` for query/page (Next.js 16 async)
    - Masonry-style or grid layout of generated images
    - Each image card shows: the image, book title, character name (if applicable), creator name+avatar, generation date, truncated prompt
    - Clicking an image opens a Dialog/Modal with full-size image, full prompt, and link to the book detail page
    - Pagination at bottom (simple prev/next)
  - Create `components/gallery-card.tsx` — image card component:
    - Uses shadcn Card with `next/image` for optimized loading
    - Overlay or caption with book/character/creator info
  - Create `components/gallery-modal.tsx` — full-size image dialog:
    - Uses shadcn Dialog
    - Shows full image, full prompt, book link, character name, creator info
  - Add "Gallery" link to main navigation (update `app/(main)/layout.tsx` nav)
  - Make gallery accessible to all authenticated users

  **Must NOT do**:
  - Do NOT implement infinite scroll (use simple pagination)
  - Do NOT add download/save/share functionality
  - Do NOT add image likes or rating
  - Do NOT add image deletion from gallery (only creator can delete from book detail page)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Gallery layout, masonry grid, image cards, modals — primarily visual work
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: Image optimization with next/image, efficient data fetching for gallery

  **Parallelization**:
  - **Can Run In Parallel**: NO (after T9)
  - **Parallel Group**: Wave 4 (T8 → T9 → T10)
  - **Blocks**: T11
  - **Blocked By**: T9 (needs GeneratedImage records), T4 (layout for nav update)

  **References**:

  **Pattern References**:
  - `app/(main)/layout.tsx` (from T4) — Add "Gallery" link to navigation
  - `lib/db.ts` (from T1) — Prisma client for gallery queries
  - `prisma/schema.prisma` (T3) — GeneratedImage with relations to Book, Character, User
  - `components/ui/card.tsx`, `components/ui/dialog.tsx` (from T1) — shadcn components for gallery

  **API/Type References**:
  - GeneratedImage query: include `{ book: true, character: true, user: { select: { name: true, image: true } } }`
  - Search filter: `where: { OR: [{ book: { title: { contains: query, mode: 'insensitive' } } }, { character: { name: { contains: query, mode: 'insensitive' } } }] }`
  - Pagination: `skip: (page - 1) * 20, take: 20`

  **External References**:
  - `node_modules/next/dist/docs/01-app/01-getting-started/` — async searchParams for pagination
  - Prisma case-insensitive filtering: https://www.prisma.io/docs/orm/prisma-client/queries/case-sensitivity

  **WHY Each Reference Matters**:
  - Prisma query patterns: Complex JOIN with search across multiple relations requires specific Prisma `include` + `where` syntax
  - next/image: Gallery must use optimized images with proper sizes and loading="lazy"

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Gallery page renders with images
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user authenticated, at least 1 generated image exists in DB
    Steps:
      1. Navigate to `http://localhost:3000/gallery`
      2. Wait for page load (timeout: 10s)
      3. Assert gallery grid exists with at least 1 image card
      4. Assert each card shows: image, book title, creator name
      5. Take screenshot
    Expected Result: Gallery page with image grid, each card showing metadata
    Failure Indicators: Empty gallery, missing metadata, layout broken
    Evidence: .sisyphus/evidence/task-10-gallery-grid.png

  Scenario: Gallery search filters by book title
    Tool: Playwright (playwright skill)
    Preconditions: Gallery has images for multiple books
    Steps:
      1. Navigate to `http://localhost:3000/gallery`
      2. Type "Gatsby" in search input
      3. Wait for results to update (1s)
      4. Assert all visible image cards are related to books containing "Gatsby" in title
      5. Assert images from other books are NOT shown
    Expected Result: Only Gatsby-related images displayed
    Failure Indicators: Unrelated images shown, no results when should have results
    Evidence: .sisyphus/evidence/task-10-gallery-search.png

  Scenario: Gallery search filters by character name
    Tool: Playwright (playwright skill)
    Preconditions: Gallery has character-specific images
    Steps:
      1. Navigate to `http://localhost:3000/gallery`
      2. Type a known character name in search input
      3. Wait for results
      4. Assert results include images for that character
    Expected Result: Character-specific images displayed
    Failure Indicators: No results, wrong character's images
    Evidence: .sisyphus/evidence/task-10-gallery-character-search.png

  Scenario: Image modal opens with full details
    Tool: Playwright (playwright skill)
    Preconditions: Gallery has at least 1 image
    Steps:
      1. Navigate to gallery page
      2. Click on first image card
      3. Assert dialog/modal opens
      4. Assert modal shows: full-size image, prompt text, book title, creator name
      5. Assert link to book detail page exists
      6. Take screenshot
    Expected Result: Modal with full image details and book link
    Failure Indicators: No modal, missing info, broken link
    Evidence: .sisyphus/evidence/task-10-gallery-modal.png
  ```

  **Commit**: YES
  - Message: `feat(gallery): image gallery with search by book and character`
  - Files: `lib/actions/gallery.ts`, `app/(main)/gallery/page.tsx`, `components/gallery-card.tsx`, `components/gallery-modal.tsx`, `app/(main)/layout.tsx` (updated nav)
  - Pre-commit: `pnpm build`

- [ ] 11. Auth Guards + Protected Routes + UX Polish

  **What to do**:
  - Read `node_modules/next/dist/docs/` for proxy.ts conventions in Next.js 16
  - Create `proxy.ts` at project root — auth session guard:
    - Use `import { getSessionCookie } from "better-auth/cookies"` for fast cookie check (NOT full session validation)
    - Protected paths: `/search`, `/book/*`, `/gallery`, `/generate`
    - Public paths: `/login`, `/api/auth/*`
    - If no session cookie on protected path → redirect to `/login`
    - If session cookie exists on `/login` → redirect to `/search` (home for authenticated users)
    - Export `function proxy()` (NOT `middleware()`) — Next.js 16 convention
  - Update `app/page.tsx` (root page):
    - If authenticated → redirect to `/search`
    - If not authenticated → show simple landing page with app description and "Sign in with Google" button
  - Update `app/(main)/layout.tsx`:
    - Ensure user nav (avatar, sign out) works correctly with session data
    - Add active state to nav links (highlight current page)
  - UX Polish:
    - Add loading states where missing (Skeleton for image loading, spinner for form submissions)
    - Add error states where missing (toast notifications for failed actions using shadcn Sonner or similar)
    - Install and configure `sonner` for toast notifications: `pnpm add sonner`
    - Add `<Toaster />` to root layout
    - Ensure all forms show success/error feedback via toast
    - Add empty states for: no reviews yet, no characters yet, no images yet
    - Verify responsive design on mobile breakpoints (nav collapses to hamburger)
  - Verify ALL pages use async request APIs (cookies, headers, params, searchParams)

  **Must NOT do**:
  - Do NOT create `middleware.ts` — ONLY `proxy.ts`
  - Do NOT add complex redirect logic or role-based access
  - Do NOT add loading.tsx/error.tsx for every route segment
  - Do NOT add animations beyond toast notifications
  - Do NOT add new features — only polish existing ones

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Cross-cutting concerns (auth guards, UX polish, responsive), touches many files
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: Performance patterns, proper React 19 usage

  **Parallelization**:
  - **Can Run In Parallel**: NO (final implementation task)
  - **Parallel Group**: Wave 5 (solo)
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: T2 (auth), T4 (layout), T10 (gallery — all features must exist first)

  **References**:

  **Pattern References**:
  - `lib/auth-client.ts` (from T2) — `useSession()` for nav user info
  - `lib/auth.ts` (from T2) — `auth.api.getSession()` for server-side session check
  - `app/(main)/layout.tsx` (from T4) — Update nav with active states, responsive hamburger
  - `app/page.tsx` — Current default page; replace with landing/redirect logic
  - `app/(auth)/login/page.tsx` (from T2) — Login page, add redirect-if-authenticated

  **API/Type References**:
  - better-auth cookies: `import { getSessionCookie } from "better-auth/cookies"` — fast cookie check for proxy
  - Next.js 16 proxy: `export function proxy(request: NextRequest)` in `proxy.ts` at project root
  - Sonner toast: `import { toast } from "sonner"` → `toast.success("Review saved!")`, `toast.error("Failed to save")`

  **External References**:
  - `node_modules/next/dist/docs/` — proxy.ts convention for Next.js 16 (MUST read before implementing)
  - better-auth cookies: https://better-auth.com/docs/integrations/next#middleware
  - Sonner: https://sonner.emilkowal.dev/

  **WHY Each Reference Matters**:
  - proxy.ts docs: CRITICAL — using middleware.ts will NOT work in Next.js 16
  - better-auth cookies: Fast check without DB query for proxy; full validation in server actions
  - Sonner: User feedback for all form submissions (create review, add character, generate image)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Unauthenticated user redirected to login
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user NOT authenticated (clear cookies)
    Steps:
      1. Navigate to `http://localhost:3000/search`
      2. Assert URL redirected to `/login`
      3. Navigate to `http://localhost:3000/gallery`
      4. Assert URL redirected to `/login`
      5. Navigate to `http://localhost:3000/book/zyTCAlFPjgYC`
      6. Assert URL redirected to `/login`
    Expected Result: All protected routes redirect to /login
    Failure Indicators: Page loads without redirect, 500 error
    Evidence: .sisyphus/evidence/task-11-auth-redirect.png

  Scenario: Authenticated user redirected from login
    Tool: Playwright (playwright skill)
    Preconditions: User IS authenticated
    Steps:
      1. Navigate to `http://localhost:3000/login`
      2. Assert URL redirected to `/search` (home for auth users)
    Expected Result: Login page redirects authenticated users to search
    Failure Indicators: Login page shown to authenticated user
    Evidence: .sisyphus/evidence/task-11-login-redirect.png

  Scenario: Landing page shows sign-in for unauthenticated
    Tool: Playwright (playwright skill)
    Preconditions: User NOT authenticated
    Steps:
      1. Navigate to `http://localhost:3000`
      2. Assert page shows app description text
      3. Assert "Sign in with Google" button exists
      4. Take screenshot
    Expected Result: Landing page with description and sign-in button
    Failure Indicators: Redirect to login, blank page
    Evidence: .sisyphus/evidence/task-11-landing.png

  Scenario: Toast notifications on actions
    Tool: Playwright (playwright skill)
    Preconditions: User authenticated, on book detail page
    Steps:
      1. Create a review (fill form, submit)
      2. Assert toast notification appears with success message (e.g., `[data-sonner-toast]` or `[role="status"]`)
      3. Take screenshot of toast
    Expected Result: Toast appears briefly after successful action
    Failure Indicators: No toast, toast stays permanently, wrong message
    Evidence: .sisyphus/evidence/task-11-toast.png

  Scenario: proxy.ts exists, middleware.ts does NOT
    Tool: Bash
    Preconditions: All files created
    Steps:
      1. Run `ls proxy.ts` — should exist
      2. Run `ls middleware.ts 2>&1` — should NOT exist (error expected)
      3. Run `pnpm build` — should pass
    Expected Result: proxy.ts exists, middleware.ts absent, build passes
    Failure Indicators: middleware.ts found, proxy.ts missing, build fails
    Evidence: .sisyphus/evidence/task-11-proxy-check.txt

  Scenario: All async APIs properly awaited
    Tool: Bash
    Preconditions: All source files exist
    Steps:
      1. Search for synchronous cookies/headers/params usage: grep -r "const.*=\s*cookies()" --include="*.ts" --include="*.tsx" app/ lib/ — should find ONLY `await cookies()` patterns
      2. Search for synchronous searchParams: grep -r "searchParams\." --include="*.ts" --include="*.tsx" app/ — verify all preceded by `await`
    Expected Result: No synchronous access to cookies/headers/params/searchParams
    Failure Indicators: Pattern found without await
    Evidence: .sisyphus/evidence/task-11-async-check.txt
  ```

  **Commit**: YES
  - Message: `feat(polish): auth guards via proxy.ts, protected routes, UX polish`
  - Files: `proxy.ts`, `app/page.tsx`, `app/(main)/layout.tsx` (updated), plus minor updates to existing components for toast/error/empty states
  - Pre-commit: `pnpm build`

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns (`middleware.ts`, `images.domains`, sync `cookies()`, `tailwind.config`, webpack config) — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm build` + `pnpm eslint .`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify all `cookies()`, `headers()`, `params`, `searchParams` are awaited. Verify no `middleware.ts` exists (only `proxy.ts`).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start dev server. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration: search → open book → leave review → add character → generate image → find in gallery. Test edge cases: empty search, no results, duplicate review attempt, long prompts. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance per task. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes. Verify no `middleware.ts`, no `tailwind.config`, no sync request APIs.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Task | Commit Message | Key Files |
|------|---------------|-----------|
| T1 | `chore(foundation): initialize prisma, shadcn/ui, env config, dependencies` | `prisma/schema.prisma`, `components.json`, `package.json`, `.env.example` |
| T2 | `feat(auth): implement better-auth with Google OAuth and Prisma adapter` | `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`, `app/(auth)/` |
| T3 | `feat(db): add Book, Review, Character, GeneratedImage models + migration` | `prisma/schema.prisma`, `prisma/migrations/` |
| T4 | `feat(ui): app layout shell, navigation, dark mode, theme provider` | `app/(main)/layout.tsx`, `components/`, `proxy.ts` placeholder |
| T5 | `feat(search): Google Books API search with multilingual support` | `app/api/books/search/route.ts`, `app/(main)/search/`, `lib/google-books.ts` |
| T6 | `feat(book): book detail page with metadata from Google Books` | `app/(main)/book/[id]/page.tsx`, server actions for book save |
| T7 | `feat(reviews): reviews CRUD with star rating and server actions` | `app/(main)/book/[id]/reviews/`, server actions, components |
| T8 | `feat(characters): AI-assisted character extraction + manual CRUD` | `app/(main)/book/[id]/characters/`, `lib/openai.ts`, server actions |
| T9 | `feat(images): OpenAI image generation with Vercel Blob storage` | `app/api/images/generate/route.ts`, `lib/image-generation.ts` |
| T10 | `feat(gallery): image gallery with search by book and character` | `app/(main)/gallery/`, components, server actions |
| T11 | `feat(polish): auth guards via proxy.ts, protected routes, UX polish` | `proxy.ts`, route refinements, edge case handling |

---

## Success Criteria

### Verification Commands
```bash
pnpm build                    # Expected: Build successful
pnpm eslint .                 # Expected: No errors
curl http://localhost:3000/api/auth/get-session  # Expected: {"session":null}
curl "http://localhost:3000/api/books/search?q=Harry+Potter&lang=en"  # Expected: JSON with books array
```

### Final Checklist
- [ ] All "Must Have" items present and functional
- [ ] All "Must NOT Have" items absent from codebase
- [ ] `pnpm build` passes cleanly
- [ ] Google OAuth login → session created → protected routes accessible
- [ ] Book search works in English and Russian
- [ ] Reviews with star ratings can be created and edited
- [ ] Characters can be AI-suggested and manually added
- [ ] Image generation creates permanent Vercel Blob URLs
- [ ] Gallery shows images searchable by book and character
- [ ] Dark mode toggle works throughout the app
