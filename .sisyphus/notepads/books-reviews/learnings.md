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
