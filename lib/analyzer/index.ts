#!/usr/bin/env node

import "dotenv/config";
import { Command } from "commander";
import { readFile, readdir } from "node:fs/promises";
import { resolve, basename, dirname, relative } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { select } from "@inquirer/prompts";
import type { UsageTotals } from "./llm-client";
import { consoleContext, runWithContext } from "./run-context";
import { defaultOutputPath, runAnalysis } from "./run";
import type { BookAnalysis } from "./types";
import { publishBook } from "./publish";

type SelectChoice = { name: string; value: string };

const __dirname = dirname(fileURLToPath(import.meta.url));
const generatedDir = resolve(__dirname, "generated");

function printAnalyzeSummary(
  result: BookAnalysis,
  outputPath: string,
  elapsed: string,
  usage: UsageTotals[],
) {
  const totalChars =
    result.characters.main.length +
    result.characters.secondary.length +
    result.characters.minor.length;

  console.log("\n" + "=".repeat(60));
  console.log("  Результат");
  console.log("=".repeat(60));
  console.log(`  Книга:           ${result.title}`);
  console.log(`  Всего персонажей: ${totalChars}`);
  console.log(`    Главные:        ${result.characters.main.length}`);
  console.log(`    Второстепенные: ${result.characters.secondary.length}`);
  console.log(`    Эпизодические:  ${result.characters.minor.length}`);
  console.log(`  Событий:          ${result.plotSummary.keyEvents.length}`);
  console.log(`  Время:            ${elapsed}с`);
  console.log(`  Сохранено:        ${outputPath}`);
  printUsage(usage);
  console.log("=".repeat(60));
}

function printUsage(report: UsageTotals[]) {
  if (report.length === 0) return;

  console.log("-".repeat(60));
  console.log("  Использование LLM");
  for (const u of report) {
    const batchNote =
      u.batchRequests > 0 ? ` (${u.batchRequests} через batch)` : "";
    console.log(`  ${u.model}: ${u.requests} запрос(ов)${batchNote}`);
    console.log(
      `    вход: ${u.inputTokens.toLocaleString()} токенов, выход: ${u.outputTokens.toLocaleString()} токенов`,
    );
    if (u.cacheReadTokens > 0 || u.cacheWriteTokens > 0) {
      console.log(
        `    кэш: ${u.cacheReadTokens.toLocaleString()} прочитано, ${u.cacheWriteTokens.toLocaleString()} записано`,
      );
    }
    if (u.estimatedCostUsd !== null) {
      console.log(`    оценка стоимости: $${u.estimatedCostUsd.toFixed(3)}`);
    }
  }
}

async function findAnalysisFiles() {
  if (!existsSync(generatedDir)) return [];

  const files = await readdir(generatedDir, { recursive: true });
  const jsonFiles = files.filter((file) =>
    String(file).endsWith(".analysis.json"),
  );

  const entries: SelectChoice[] = await Promise.all(
    jsonFiles.map(async (file) => {
      const absolutePath = resolve(generatedDir, String(file));
      try {
        const parsed = JSON.parse(await readFile(absolutePath, "utf-8"));
        return {
          name: `${parsed.title ?? basename(String(file))} (${relative(generatedDir, absolutePath)})`,
          value: absolutePath,
        };
      } catch {
        return {
          name: `${basename(String(file))} (${relative(generatedDir, absolutePath)})`,
          value: absolutePath,
        };
      }
    }),
  );

  return entries;
}

const program = new Command();

program
  .name("book-analyzer")
  .description(
    "Анализ книг из PDF: извлечение персонажей, классификация, краткое содержание",
  )
  .version("1.0.0");

program
  .command("analyze")
  .description("Анализировать PDF книги")
  .argument("<pdf>", "Путь к PDF файлу")
  .option("-o, --output <path>", "Путь для сохранения результата (JSON)")
  .option(
    "-m, --model <name>",
    "Модель: Ollama (qwen3.5:latest, ...) или Claude (claude-sonnet-5, claude-opus-5)",
    "qwen3.5:latest",
  )
  .option("--title <title>", "Название книги (переопределяет извлечение LLM)")
  .option(
    "--batch",
    "Отправлять запросы через Claude Message Batches API (скидка 50%, ожидание до 1 ч на фазу)",
    false,
  )
  .option(
    "--fresh",
    "Игнорировать промежуточные результаты предыдущего запуска",
    false,
  )
  .option(
    "--chunk-tokens <n>",
    "Размер фрагмента в токенах (по умолчанию зависит от модели: 20k локально, 100k Ollama cloud, 120k Claude)",
    (v: string) => Number.parseInt(v, 10),
  )
  .action(
    async (
      pdfPath: string,
      opts: {
        output?: string;
        model: string;
        title?: string;
        batch: boolean;
        fresh: boolean;
        chunkTokens?: number;
      },
    ) => {
      try {
        const absolutePath = resolve(pdfPath);
        const outputPath = opts.output
          ? resolve(opts.output)
          : defaultOutputPath(absolutePath, opts.model, opts.chunkTokens);

        console.log("=".repeat(60));
        console.log("  Book Analyzer");
        console.log("=".repeat(60));
        console.log(`  PDF:    ${absolutePath}`);
        console.log(`  Модель: ${opts.model}${opts.batch ? " (batch)" : ""}`);
        console.log(`  Вывод:  ${outputPath}`);
        console.log("=".repeat(60));

        // Ctrl+C отменяет текущие запросы к LLM через сигнал контекста
        const controller = new AbortController();
        process.once("SIGINT", () => {
          console.log("\n⛔ Прерывание — отменяю запросы к LLM...");
          controller.abort();
          setTimeout(() => process.exit(130), 500);
        });

        const run = await runWithContext(
          consoleContext(controller.signal),
          () =>
            runAnalysis({
              pdfPath: absolutePath,
              model: opts.model,
              chunkTokens: opts.chunkTokens,
              title: opts.title,
              batch: opts.batch,
              fresh: opts.fresh,
              outputPath,
            }),
        );

        printAnalyzeSummary(
          run.result,
          run.outputPath,
          (run.elapsedMs / 1000).toFixed(1),
          run.usage,
        );
      } catch (error) {
        console.error(
          "\nОшибка:",
          error instanceof Error ? error.message : error,
        );
        process.exit(1);
      }
    },
  );

program
  .command("publish")
  .description("Публиковать JSON анализа в БД и сгенерировать изображения")
  .argument("[json-path]", "Путь к .analysis.json файлу")
  .option("--book-series-id <id>", "ID серии книги")
  .option("--published-date <date>", "Дата публикации")
  .option(
    "-m, --model <name>",
    "Модель для поиска года публикации (Ollama или Claude)",
    "qwen3.5:latest",
  )
  .option(
    "--skip-images",
    "Не генерировать обложку и картинки персонажей",
    false,
  )
  .option(
    "--dry-run",
    "Проверить сохранение: выполнить в транзакции и откатить, ничего не записывая",
    false,
  )
  .action(
    async (
      jsonPath: string | undefined,
      opts: {
        bookSeriesId?: string;
        publishedDate?: string;
        model: string;
        skipImages: boolean;
        dryRun: boolean;
      },
    ) => {
      try {
        let analysisPath = jsonPath ? resolve(jsonPath) : "";

        if (!analysisPath) {
          const choices = await findAnalysisFiles();
          if (choices.length === 0) {
            console.log("Нет файлов анализа в lib/analyzer/generated/");
            process.exit(0);
          }

          analysisPath = await select({
            message: "Выберите файл анализа:",
            choices,
          });
        }

        if (!existsSync(analysisPath)) {
          console.error(`Файл не найден: ${analysisPath}`);
          process.exit(1);
        }
        await publishBook(analysisPath, {
          bookSeriesId: opts.bookSeriesId,
          publishedDate: opts.publishedDate,
          model: opts.model,
          skipImages: opts.skipImages,
          dryRun: opts.dryRun,
          onProgress: console.log,
        });
      } catch (error) {
        console.error(
          "\nОшибка:",
          error instanceof Error ? error.message : error,
        );
        process.exit(1);
      }
    },
  );

program.parse();

process.once("SIGINT", async () => {
  console.log("\n🛑 Завершение работы...");
  const prisma = (await import("../db")).default;
  await prisma.$disconnect();
  process.exit();
});
