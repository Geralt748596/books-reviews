This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Анализатор книг

Пайплайн: PDF → извлечение персонажей и сюжета моделью → `lib/analyzer/generated/**/*.analysis.json` → публикация в базу.

### Настройка

Переменные в `.env` (см. `.env.example`):

| Переменная | Зачем |
|---|---|
| `OLLAMA_HOST` | локальный/LAN сервер Ollama или `https://ollama.com` для прямого доступа к облаку |
| `OLLAMA_API_KEY` | нужен только при `OLLAMA_HOST=https://ollama.com` (ключ на ollama.com/settings/keys) |
| `ANTHROPIC_API_KEY` | только для моделей `claude-*` |
| `ANALYZER_ADMIN_USER_ID` | от чьего имени CLI `publish` создаёт картинки |

Модель по умолчанию в админке: `deepseek-v4.1-flash` через ollama.com, размер фрагмента 100 000 токенов.
При прямом подключении к ollama.com модели называются без суффикса `:cloud`.

### CLI

```bash
pnpm analyze "lib/analyzer/books/book.pdf" -m deepseek-v4.1-flash --chunk-tokens 100000
pnpm analyze "lib/analyzer/books/book.pdf" -m claude-sonnet-5 --batch     # Claude Message Batches, −50%
pnpm exec tsx lib/analyzer/index.ts publish path/to/book.analysis.json --dry-run
pnpm test:analyzer
```

Промежуточные результаты лежат в `<результат>.work/` и переиспользуются при повторном запуске с теми же моделью и размером фрагмента; `--fresh` их игнорирует. Рядом с результатом пишется `<результат>.meta.json` с параметрами запуска.

### Админка `/admin/analyze`

Мастер из трёх шагов: PDF, название и серия → оценка объёма, размер фрагмента и модель → живой лог выполнения, итог и публикация в базу. Анализ идёт как фоновая задача в процессе сервера: страницу можно перезагрузить, лог восстановится по ссылке с `?job=`.

Ограничение: долгие задачи живут в процессе Next, поэтому страница рассчитана на локальный запуск или self-hosted сервер. На serverless-платформах функция завершится по таймауту раньше конца анализа.

Подробный план и решения: `ADMIN_ANALYZE_PAGE_PLAN.md`.
