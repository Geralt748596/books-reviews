#!/usr/bin/env node

import "dotenv/config";
import { Command } from "commander";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, basename, dirname, relative } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { select } from "@inquirer/prompts";
import { extractTextFromPdf } from "./pdf-extractor";
import { analyzeBook } from "./analyzer";
import { getUsageReport } from "./llm-client";
import type { BookAnalysis } from "./types";
import { publishBook } from "./publish";

type SelectChoice = { name: string; value: string };

const __dirname = dirname(fileURLToPath(import.meta.url));
const generatedDir = resolve(__dirname, "generated");

function printAnalyzeSummary(
  result: BookAnalysis,
  outputPath: string,
  elapsed: string,
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
  printUsage();
  console.log("=".repeat(60));
}

function printUsage() {
  const report = getUsageReport();
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

        if (!existsSync(absolutePath)) {
          console.error(`Файл не найден: ${absolutePath}`);
          process.exit(1);
        }

        if (!absolutePath.toLowerCase().endsWith(".pdf")) {
          console.error("Файл должен быть в формате PDF");
          process.exit(1);
        }

        const modelDir = resolve(
          __dirname,
          "generated",
          opts.model.replace(/[/:]/g, "-"),
        );
        await mkdir(modelDir, { recursive: true });

        const outputPath = opts.output
          ? resolve(opts.output)
          : resolve(
              modelDir,
              basename(absolutePath, ".pdf") + ".analysis.json",
            );

        console.log("=".repeat(60));
        console.log("  Book Analyzer");
        console.log("=".repeat(60));
        console.log(`  PDF:    ${absolutePath}`);
        console.log(`  Модель: ${opts.model}${opts.batch ? " (batch)" : ""}`);
        console.log(`  Вывод:  ${outputPath}`);
        console.log("=".repeat(60));

        const startTime = Date.now();

        let result: BookAnalysis;

        if (existsSync(outputPath)) {
          console.log(`\n✅ Найден готовый анализ: ${outputPath}`);
          result = JSON.parse(
            await readFile(outputPath, "utf-8"),
          ) as BookAnalysis;
        } else {
          console.log("\n📄 Извлечение текста из PDF...");
          const { text, totalPages } = await extractTextFromPdf(absolutePath);
          console.log(`   Извлечено ${totalPages} страниц(ы)`);

          if (opts.chunkTokens !== undefined && !(opts.chunkTokens > 1000)) {
            console.error("--chunk-tokens должен быть числом больше 1000");
            process.exit(1);
          }

          result = await analyzeBook({
            text,
            model: opts.model,
            outputPath,
            title: opts.title,
            batch: opts.batch,
            fresh: opts.fresh,
            chunkTokens: opts.chunkTokens,
          });

          await writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8");
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        printAnalyzeSummary(result, outputPath, elapsed);
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
