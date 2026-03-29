# Decisions

## [2026-03-29] Architecture Decisions
- Characters: AI-suggested from book description + user can add/edit/remove (shared per book globally)
- Image storage: Vercel Blob (OpenAI URLs expire ~1h)
- Database: Neon PostgreSQL (dev + prod)
- Auth: Google OAuth only via better-auth
- Tests: No automated tests, only agent QA scenarios
- One review per user per book (unique constraint, editable)
- 10 AI image generations per user per day (enforced in server action)
- Book metadata cached in DB on first book detail page visit (not during search)
- No pagination in v1 (search maxResults=20, show all reviews)
