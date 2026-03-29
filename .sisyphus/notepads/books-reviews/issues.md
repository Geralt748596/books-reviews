# Issues

## [2026-03-29] Known Risks
- better-auth has peer dependency issue with Next.js 16 — may need --legacy-peer-deps or --force
- better-auth PR #8462 open for router refresh bug
- Google Books API 1000 req/day free tier — book metadata must be cached in DB
- OpenAI cost explosion risk — enforce 10 images/user/day limit in server action
- toNextJsHandler from better-auth may not handle async params — may need thin wrapper
