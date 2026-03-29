# Learnings

## [2026-03-29] Setup
- Next.js 16.2.1, React 19.2.4, Tailwind v4, TypeScript, pnpm
- No implementation started — clean scaffold
- Use pnpm for all package installs
- `@/*` path alias maps to project root (tsconfig.json)
- postcss.config.mjs already configured with @tailwindcss/postcss — DO NOT MODIFY
- NO tailwind.config.* allowed (Tailwind v4 CSS-first)
- NO middleware.ts — use proxy.ts for auth guards
- ALL request APIs must be async: await cookies(), await headers(), await params, await searchParams
- images.remotePatterns (NOT images.domains) in next.config.ts
- NO webpack config — Turbopack is default
- NO next lint — use pnpm eslint
- Better-auth may need --legacy-peer-deps
- Prisma singleton via globalThis required for hot reload safety
- OpenAI image URLs expire — always use b64_json and upload to Vercel Blob
- gpt-image-1 for images, gpt-4o-mini for character text extraction

## [2026-03-29] Task 1 Learnings: Prisma v7 Breaking Changes
- Prisma installed is v7.6.0 (NOT v5/v6 as expected)
- prisma init generates prisma.config.ts (new in v7) with datasource.url
- schema.prisma datasource MUST NOT have `url` field in v7 (P1012 error if present)
- `generator client` uses `provider = "prisma-client-js"` NOT `provider = "prisma-client"`
- Connection URL is configured in prisma.config.ts (already has `process.env["DATABASE_URL"]`)
- `new PrismaClient()` with no args works in v7 — URL comes from prisma.config.ts at runtime
- `datasourceUrl` property does NOT exist on PrismaClientOptions in v7
- lib/db.ts: use plain `new PrismaClient()` — no constructor args needed
- shadcn init -d now defaults to "base-nova" style (not "default" or "new-york")
- globals.css is now fully replaced by shadcn init (adds @import "shadcn/tailwind.css", @custom-variant dark, etc.)
- components.json has `"config": ""` (blank) for Tailwind v4 — correct
- pnpm approve-builds needed for some packages (msw) but doesn't block install
- ALL prisma operations must use: npx prisma generate (no migrate yet — no real DB)
