# Analyzer DB Integration: Title/Author Extraction + Book/Character Persistence

## TL;DR

> **Quick Summary**: Extend the book analyzer to extract title/authors via LLM, find publishedDate via Ollama web search, persist Book and Characters to PostgreSQL after analysis, and handle character deduplication across book series.
> 
> **Deliverables**:
> - Schema migration: remove `googleBooksId`, remove `createdById` from Character, add `aliases` to Character
> - Fix all broken web app code (actions, seed script)
> - New LLM prompts for title/author extraction from first chunk
> - Ollama web search for publishedDate
> - DB persistence layer after `analyzeBook()` completes
> - CLI options: `--title`, `--book-series-id`
> - Character deduplication logic for series
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Schema migration → Fix broken refs → Analyzer extensions → DB persistence

---

## Context

### Original Request
Extend the analyzer to: (1) find book title in first chunk, (2) create Book in DB after analysis, (3) support `--book-series-id` to link to series, (4) deduplicate characters across series by name+aliases.

### Interview Summary
**Key Discussions**:
- Title: CLI `--title` param OR LLM extraction from first chunk
- Authors: LLM extraction from text
- `googleBooksId`: REMOVE from schema entirely (no unique constraint replacement needed)
- `createdById` on Character: REMOVE from schema
- Add `aliases String[]` to Character model
- publishedDate: Ollama web search
- Character matching for series: by name + aliases (case-insensitive)
- Language: already detected by `detectLanguage()` in text-chunker.ts
- No automated tests
- Keep JSON file output as-is, add DB persistence as additional step

### Metis Review
**Identified Gaps** (addressed):
- `saveBookToDb()` in `lib/actions/books.ts` uses `googleBooksId` upsert — must be rewritten
- `addCharacter()` uses `createdById` — must be updated
- `scripts/seed.ts` uses both `googleBooksId` and `createdById` — must be updated
- `CharacterWithCreator` type used in web app — must be removed/replaced
- `updateCharacter` and `deleteCharacter` check `createdById` for auth — need new auth strategy

---

## Work Objectives

### Core Objective
Extend the CLI analyzer to persist analysis results (Book + Characters + CharacterDescriptions) to the database, with series-aware character deduplication.

### Concrete Deliverables
- Updated `prisma/schema.prisma` with migration
- Fixed `lib/actions/books.ts`, `lib/actions/characters.ts`, `scripts/seed.ts`
- New file: `lib/analyzer/db-persistence.ts` (persist logic)
- Updated `lib/analyzer/index.ts` (new CLI options)
- Updated `lib/analyzer/analyzer.ts` (title/author extraction from first chunk)
- New LLM prompt for title+author extraction
- Ollama web search integration for publishedDate

### Definition of Done
- [ ] `npx prisma validate` passes
- [ ] `npx prisma generate` succeeds
- [ ] `npx tsx lib/analyzer/index.ts analyze test.pdf` completes and creates Book in DB
- [ ] `npx tsx lib/analyzer/index.ts analyze test.pdf --book-series-id <id>` links book to series and deduplicates characters
- [ ] No TypeScript errors in modified files

### Must Have
- Title extraction via LLM from first chunk (fallback to Pass 2 classification title)
- Author extraction via LLM from first chunk
- `--title` CLI override
- `--book-series-id` CLI option
- Book creation in DB after analysis
- Character creation/linking with CharacterDescription
- Character deduplication by name+aliases within series
- Ollama web search for publishedDate

### Must NOT Have (Guardrails)
- No UI changes beyond what schema removal requires for compilation
- No Google Books API integration
- No automated tests
- No error recovery/retry for DB persistence (fail loudly)
- No changes to existing 3-pass analyzer flow structure
- Do NOT remove the JSON file output

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test configured)
- **Automated tests**: None (user decision)
- **Framework**: N/A

### QA Policy
Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Schema**: `npx prisma validate` + `npx prisma generate`
- **CLI**: Run analyzer with test PDF and verify DB records via prisma studio or direct query
- **Web app fixes**: `lsp_diagnostics` on modified files

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - schema + fix broken refs):
├── Task 1: Prisma schema migration [quick]
├── Task 2: Fix lib/actions/books.ts [quick]
├── Task 3: Fix lib/actions/characters.ts [quick]
├── Task 4: Fix scripts/seed.ts [quick]

Wave 2 (Analyzer extensions - all independent after Wave 1):
├── Task 5: LLM prompt for title+author extraction [quick]
├── Task 6: Ollama web search for publishedDate [quick]
├── Task 7: Update analyzer.ts - extract title/author in Pass 1 [unspecified-high]

Wave 3 (Integration - depends on Wave 1 + 2):
├── Task 8: DB persistence layer (lib/analyzer/db-persistence.ts) [deep]
├── Task 9: CLI updates (index.ts - new options + call persistence) [quick]

Wave FINAL (Verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix

| Task | Blocked By | Blocks |
|------|-----------|--------|
| 1 | - | 2, 3, 4, 8 |
| 2 | 1 | 9 |
| 3 | 1 | 8 |
| 4 | 1 | - |
| 5 | - | 7 |
| 6 | - | 8 |
| 7 | 5 | 8 |
| 8 | 1, 3, 6, 7 | 9 |
| 9 | 2, 8 | F1-F4 |

### Agent Dispatch Summary

- **Wave 1**: 4 tasks — T1-T4 → `quick`
- **Wave 2**: 3 tasks — T5-T6 → `quick`, T7 → `unspecified-high`
- **Wave 3**: 2 tasks — T8 → `deep`, T9 → `quick`
- **FINAL**: 4 tasks — F1 → `oracle`, F2-F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Prisma Schema Migration

  **What to do**:
  - Remove `googleBooksId` field and its `@unique` + `@@index` from Book model
  - Remove `createdById` and `createdBy` relation from Character model
  - Remove `characters Character[]` from User model
  - Add `aliases String[] @default([])` to Character model
  - Run `npx prisma migrate dev --name remove-google-books-id-add-aliases`

  **Must NOT do**:
  - Don't touch any other models
  - Don't change CharacterDescription schema

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`prisma-cli-migrate-dev`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (must be first)
  - **Blocks**: Tasks 2, 3, 4, 8

  **References**:
  - `prisma/schema.prisma:92-116` — Book model (remove googleBooksId line 94, @@index line 114)
  - `prisma/schema.prisma:153-167` — Character model (remove createdById/createdBy lines 158-159, add aliases)
  - `prisma/schema.prisma:25` — User model characters relation (remove)

  **Acceptance Criteria**:
  - [ ] `npx prisma validate` → success
  - [ ] `npx prisma generate` → success
  - [ ] Migration file created in `prisma/migrations/`

  **QA Scenarios**:
  ```
  Scenario: Schema validates after migration
    Tool: Bash
    Steps:
      1. Run `npx prisma validate`
      2. Run `npx prisma generate`
    Expected Result: Both exit code 0
    Evidence: .sisyphus/evidence/task-1-schema-validate.txt

  Scenario: Generated client has aliases field on Character
    Tool: Bash
    Steps:
      1. grep "aliases" prisma/generated/models/Character.ts
    Expected Result: Field exists as string[]
    Evidence: .sisyphus/evidence/task-1-aliases-field.txt
  ```

  **Commit**: YES
  - Message: `feat(schema): remove googleBooksId, remove createdById from Character, add aliases`
  - Files: `prisma/schema.prisma`, `prisma/migrations/*`

- [x] 2. Fix lib/actions/books.ts

  **What to do**:
  - Rewrite `saveBookToDb()`: remove upsert by `googleBooksId`, change to simple `prisma.book.create()` accepting title, authors, description, etc. directly (no GoogleBooksVolume dependency)
  - Remove import of `GoogleBooksVolume` type if no longer used elsewhere
  - Keep `findBook`, `getBookById`, `findBooksOrCharacters` as-is (they don't use googleBooksId)

  **Must NOT do**:
  - Don't change query logic for findBook/getBookById

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 3, 4 after Task 1)
  - **Blocked By**: Task 1

  **References**:
  - `lib/actions/books.ts:100-128` — `saveBookToDb()` to rewrite
  - `lib/google-books.ts` — GoogleBooksVolume type (may still be used elsewhere for search)

  **Acceptance Criteria**:
  - [ ] `lsp_diagnostics` on `lib/actions/books.ts` → no errors

  **QA Scenarios**:
  ```
  Scenario: No TypeScript errors
    Tool: lsp_diagnostics
    Steps:
      1. Check lib/actions/books.ts
    Expected Result: 0 errors
    Evidence: .sisyphus/evidence/task-2-diagnostics.txt
  ```

  **Commit**: YES (groups with 3, 4)
  - Message: `fix(actions): update books/characters/seed after schema migration`
  - Files: `lib/actions/books.ts`, `lib/actions/characters.ts`, `scripts/seed.ts`

- [x] 3. Fix lib/actions/characters.ts

  **What to do**:
  - Remove `CharacterWithCreator` type (replace with simple type without `createdById`/`createdBy`)
  - Update `addCharacter()`: remove `createdById: session.user.id` from create
  - Update `updateCharacter()`: remove `createdById` ownership check (anyone can update? or remove function?)
  - Update `deleteCharacter()`: remove `createdById` ownership check
  - Update `getBookCharacters()`: remove `include: { createdBy }` 
  - Fix all return types

  **Must NOT do**:
  - Don't change `suggestCharacters()` logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 2, 4 after Task 1)
  - **Blocked By**: Task 1
  - **Blocks**: Task 8

  **References**:
  - `lib/actions/characters.ts:15-23` — CharacterWithCreator type to replace
  - `lib/actions/characters.ts:67-86` — create logic to update
  - `lib/actions/characters.ts:106,140` — ownership checks to remove

  **Acceptance Criteria**:
  - [ ] `lsp_diagnostics` on `lib/actions/characters.ts` → no errors
  - [ ] No references to `createdById` remain in file

  **QA Scenarios**:
  ```
  Scenario: No TypeScript errors
    Tool: lsp_diagnostics
    Steps:
      1. Check lib/actions/characters.ts
    Expected Result: 0 errors
    Evidence: .sisyphus/evidence/task-3-diagnostics.txt

  Scenario: No createdById references
    Tool: Grep
    Steps:
      1. grep "createdById" lib/actions/characters.ts
    Expected Result: 0 matches
    Evidence: .sisyphus/evidence/task-3-no-createdby.txt
  ```

  **Commit**: YES (groups with 2, 4)

- [x] 4. Fix scripts/seed.ts

  **What to do**:
  - Remove `googleBooksId` from all book data objects
  - Change book upserts to use `id` field with fixed seed IDs (e.g. `"seed_book_last_wish"`) for idempotent seeding
  - Remove `createdById` from character creates
  - Remove `deleteMany` where clauses that filter by `createdById`
  - Update `bookIdByGoogleId` map to use the fixed seed IDs directly

  **Must NOT do**:
  - Don't change the actual seed data content (names, descriptions)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 2, 3 after Task 1)
  - **Blocked By**: Task 1

  **References**:
  - `scripts/seed.ts:9-32` — WITCHER_BOOKS data (remove googleBooksId)
  - `scripts/seed.ts:140-150` — WAR_AND_PEACE data
  - `scripts/seed.ts:197-211` — book upsert logic
  - `scripts/seed.ts:234-239` — character create with createdById

  **Acceptance Criteria**:
  - [ ] `lsp_diagnostics` on `scripts/seed.ts` → no errors
  - [ ] `npx tsx scripts/seed.ts` → runs without error (if DB available)

  **QA Scenarios**:
  ```
  Scenario: No TypeScript errors
    Tool: lsp_diagnostics
    Steps:
      1. Check scripts/seed.ts
    Expected Result: 0 errors
    Evidence: .sisyphus/evidence/task-4-diagnostics.txt
  ```

  **Commit**: YES (groups with 2, 3)

- [x] 5. LLM Prompt for Title + Author Extraction

  **What to do**:
  - Add new schema `BookMetadataSchema` in `lib/analyzer/schemas.ts`: `{ title: string, authors: string }`
  - Add new prompt function `bookMetadataPrompt(firstChunkText: string, language: string)` in `lib/analyzer/prompts.ts`
  - Prompt should instruct LLM to find book title and author(s) from the first 2-3 pages of text
  - Export from appropriate files

  **Must NOT do**:
  - Don't modify existing prompts
  - Don't call this from analyzer.ts yet (Task 7 does that)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent)
  - **Blocks**: Task 7

  **References**:
  - `lib/analyzer/prompts.ts` — existing prompt patterns to follow
  - `lib/analyzer/schemas.ts:1-48` — existing schema patterns

  **Acceptance Criteria**:
  - [ ] New `BookMetadataSchema` exported from schemas.ts
  - [ ] New `bookMetadataPrompt` exported from prompts.ts

  **QA Scenarios**:
  ```
  Scenario: Schema and prompt exist
    Tool: Grep
    Steps:
      1. grep "BookMetadataSchema" lib/analyzer/schemas.ts
      2. grep "bookMetadataPrompt" lib/analyzer/prompts.ts
    Expected Result: Both found
    Evidence: .sisyphus/evidence/task-5-exports.txt
  ```

  **Commit**: YES
  - Message: `feat(analyzer): add LLM prompt for book title and author extraction`
  - Files: `lib/analyzer/schemas.ts`, `lib/analyzer/prompts.ts`

- [x] 6. Ollama Web Search for publishedDate

  **What to do**:
  - Create function `searchPublishedDate(title: string, authors: string, model: string): Promise<string | null>` in `lib/analyzer/llm-client.ts` or new file
  - Use `ollama.chat()` with `tools` parameter for web search (check Ollama API for tool-use syntax)
  - Query: "When was [title] by [authors] published? Return only the year."
  - Return the year string or null if not found
  - Fallback gracefully if model doesn't support tools

  **Must NOT do**:
  - Don't require web search to succeed — it's best-effort
  - Don't change existing `llmStructuredRequest` function

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent)
  - **Blocks**: Task 8

  **References**:
  - `lib/analyzer/llm-client.ts:48-54` — existing ollama.chat() call pattern
  - Ollama API docs for tool use: https://github.com/ollama/ollama/blob/main/docs/api.md

  **Acceptance Criteria**:
  - [ ] Function exported and callable
  - [ ] Returns string|null
  - [ ] Handles errors gracefully (returns null on failure)

  **QA Scenarios**:
  ```
  Scenario: Function exists and is typed correctly
    Tool: lsp_diagnostics
    Steps:
      1. Check the file containing searchPublishedDate
    Expected Result: 0 errors
    Evidence: .sisyphus/evidence/task-6-diagnostics.txt
  ```

  **Commit**: YES
  - Message: `feat(analyzer): add Ollama web search for publishedDate`
  - Files: `lib/analyzer/llm-client.ts` or new file

- [x] 7. Update analyzer.ts — Extract Title/Author in Pass 1

  **What to do**:
  - Before the main chunk loop, take the first chunk and call `llmStructuredRequest` with `BookMetadataSchema` + `bookMetadataPrompt`
  - Store extracted `title` and `authors` in variables
  - If `--title` was provided via params, use that instead (skip LLM call)
  - Pass title/authors into the return value (extend `BookAnalysis` type or add to `AnalyzeParams`/return)
  - Update `AnalyzeParams` to accept optional `title?: string`
  - Update return type to include `authors: string`

  **Must NOT do**:
  - Don't restructure the 3-pass flow
  - Don't remove the title from Pass 2 classification (keep as fallback)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 5
  - **Blocks**: Task 8

  **References**:
  - `lib/analyzer/analyzer.ts:37-40` — AnalyzeParams interface
  - `lib/analyzer/analyzer.ts:49-51` — chunks creation (first chunk = chunks[0])
  - `lib/analyzer/analyzer.ts:522-530` — assembleResult (title comes from classification)
  - `lib/analyzer/schemas.ts:122-133` — BookAnalysisSchema (needs `authors` field)
  - `lib/analyzer/types.ts:16` — BookAnalysis type

  **Acceptance Criteria**:
  - [ ] `analyzeBook()` extracts title from first chunk if not provided
  - [ ] `analyzeBook()` extracts authors from first chunk
  - [ ] `BookAnalysis` result includes `authors` field
  - [ ] `lsp_diagnostics` on analyzer.ts → no errors

  **QA Scenarios**:
  ```
  Scenario: No TypeScript errors after changes
    Tool: lsp_diagnostics
    Steps:
      1. Check lib/analyzer/analyzer.ts
      2. Check lib/analyzer/types.ts
      3. Check lib/analyzer/schemas.ts
    Expected Result: 0 errors in all
    Evidence: .sisyphus/evidence/task-7-diagnostics.txt
  ```

  **Commit**: YES
  - Message: `feat(analyzer): extract title and authors from first chunk via LLM`
  - Files: `lib/analyzer/analyzer.ts`, `lib/analyzer/types.ts`, `lib/analyzer/schemas.ts`

- [ ] 8. DB Persistence Layer

  **What to do**:
  - Create `lib/analyzer/db-persistence.ts`
  - Import prisma from `@/lib/db`
  - Main function: `persistAnalysis(analysis: BookAnalysis, options: PersistOptions): Promise<{ bookId: string }>`
  - `PersistOptions`: `{ bookSeriesId?: string, publishedDate?: string | null, language?: string | null, thumbnailUrl?: string | null }`
  - Logic:
    1. Create Book record: `prisma.book.create({ data: { title, authors, description: analysis.plotSummary.overview, language, publishedDate, bookSeriesId, thumbnailUrl } })`
    2. For each character (main + secondary + minor):
       a. If `bookSeriesId` provided: query existing characters in that series by name+aliases (case-insensitive) — `prisma.character.findMany({ where: { books: { some: { bookSeriesId } } } })` then match in-memory
       b. If match found: connect character to new book, create CharacterDescription
       c. If no match: create Character with name + aliases, connect to book, create CharacterDescription
    3. Return bookId

  **Must NOT do**:
  - No retry/recovery logic
  - No transaction wrapping (simple sequential creates are fine)
  - Don't modify the web app's prisma client setup

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`prisma-client-api-model-queries`, `prisma-client-api-relations`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Tasks 1, 3, 6, 7
  - **Blocks**: Task 9

  **References**:
  - `lib/db.ts` — prisma client import
  - `prisma/schema.prisma:80-116` — Book + BookSeries models
  - `prisma/schema.prisma:153-167` — Character model (with new aliases field)
  - `prisma/schema.prisma:169-183` — CharacterDescription model (@@unique on [bookId, characterId])
  - `lib/actions/characters.ts:67-86` — existing pattern for creating character with description
  - `lib/analyzer/types.ts` — BookAnalysis type (input to persistence)

  **Acceptance Criteria**:
  - [ ] `persistAnalysis()` exported from `lib/analyzer/db-persistence.ts`
  - [ ] Creates Book with all fields
  - [ ] Creates new Characters with aliases for characters not in series
  - [ ] Reuses existing Characters when name/alias matches (case-insensitive)
  - [ ] Creates CharacterDescription for each character-book pair
  - [ ] `lsp_diagnostics` → no errors

  **QA Scenarios**:
  ```
  Scenario: No TypeScript errors
    Tool: lsp_diagnostics
    Steps:
      1. Check lib/analyzer/db-persistence.ts
    Expected Result: 0 errors
    Evidence: .sisyphus/evidence/task-8-diagnostics.txt

  Scenario: Function signature is correct
    Tool: Grep
    Steps:
      1. grep "export.*persistAnalysis" lib/analyzer/db-persistence.ts
    Expected Result: Function exported with correct name
    Evidence: .sisyphus/evidence/task-8-export.txt
  ```

  **Commit**: YES
  - Message: `feat(analyzer): add DB persistence layer for book and characters`
  - Files: `lib/analyzer/db-persistence.ts`

- [ ] 9. CLI Updates — New Options + Call Persistence

  **What to do**:
  - Add CLI options to `analyze` command:
    - `--title <title>` (optional, override LLM extraction)
    - `--book-series-id <id>` (optional)
    - `--published-date <date>` (optional, override web search)
  - After `analyzeBook()` returns and JSON is written:
    1. Call `searchPublishedDate()` if `--published-date` not provided
    2. Call `persistAnalysis()` with all collected data
    3. Log the created book ID
  - Pass `--title` through to `analyzeBook()` params

  **Must NOT do**:
  - Don't make DB persistence optional (it always runs)
  - Don't change the JSON output behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Tasks 2, 8
  - **Blocks**: F1-F4

  **References**:
  - `lib/analyzer/index.ts:22-96` — existing CLI command structure
  - `lib/analyzer/db-persistence.ts` — persistAnalysis (created in Task 8)
  - `lib/analyzer/llm-client.ts` — searchPublishedDate (created in Task 6)

  **Acceptance Criteria**:
  - [ ] `--title`, `--book-series-id`, `--published-date` options visible in `--help`
  - [ ] End-to-end: `npx tsx lib/analyzer/index.ts analyze test.pdf` creates book in DB
  - [ ] `lsp_diagnostics` → no errors

  **QA Scenarios**:
  ```
  Scenario: CLI help shows new options
    Tool: Bash
    Steps:
      1. Run `npx tsx lib/analyzer/index.ts analyze --help`
    Expected Result: Output contains "--title", "--book-series-id", "--published-date"
    Evidence: .sisyphus/evidence/task-9-cli-help.txt

  Scenario: No TypeScript errors
    Tool: lsp_diagnostics
    Steps:
      1. Check lib/analyzer/index.ts
    Expected Result: 0 errors
    Evidence: .sisyphus/evidence/task-9-diagnostics.txt
  ```

  **Commit**: YES
  - Message: `feat(analyzer): add CLI options and DB persistence integration`
  - Files: `lib/analyzer/index.ts`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod code (analyzer CLI is fine), commented-out code, unused imports.
  Output: `Build [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Run `npx prisma migrate dev`. Run `npx tsx scripts/seed.ts`. Run analyzer on a test PDF. Verify Book + Characters created in DB. Run analyzer again with `--book-series-id` on second book and verify character dedup works.
  Output: `Scenarios [N/N pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1. Check "Must NOT do" compliance. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | VERDICT`

---

## Commit Strategy

| Task(s) | Message | Pre-commit |
|---------|---------|-----------|
| 1 | `feat(schema): remove googleBooksId, remove createdById from Character, add aliases` | `npx prisma validate` |
| 2,3,4 | `fix(actions): update books/characters/seed after schema migration` | `npx tsc --noEmit` |
| 5 | `feat(analyzer): add LLM prompt for book title and author extraction` | - |
| 6 | `feat(analyzer): add Ollama web search for publishedDate` | - |
| 7 | `feat(analyzer): extract title and authors from first chunk via LLM` | `npx tsc --noEmit` |
| 8 | `feat(analyzer): add DB persistence layer for book and characters` | `npx tsc --noEmit` |
| 9 | `feat(analyzer): add CLI options and DB persistence integration` | `npx tsc --noEmit` |

---

## Success Criteria

### Verification Commands
```bash
npx prisma validate          # Expected: valid schema
npx prisma generate          # Expected: success
npx tsc --noEmit             # Expected: 0 errors
npx tsx lib/analyzer/index.ts analyze --help  # Expected: shows --title, --book-series-id, --published-date
```

### Final Checklist
- [ ] All "Must Have" features present
- [ ] All "Must NOT Have" patterns absent
- [ ] Schema migration applied cleanly
- [ ] Web app compiles without errors
- [ ] Analyzer creates Book + Characters in DB
- [ ] Character dedup works across series
