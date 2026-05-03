#!/usr/bin/env node

import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { existsSync } from "node:fs";
import { extractTextFromPdf } from "./pdf-extractor";
import { analyzeBook } from "./analyzer";

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
  .option("-m, --model <name>", "Модель Ollama", "qwen3.5:9b")
  .action(async (pdfPath: string, opts: { output?: string; model: string }) => {
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

      const outputPath = opts.output
        ? resolve(opts.output)
        : resolve(basename(absolutePath, ".pdf") + ".analysis.json");

      console.log("=".repeat(60));
      console.log("  Book Analyzer");
      console.log("=".repeat(60));
      console.log(`  PDF:    ${absolutePath}`);
      console.log(`  Модель: ${opts.model}`);
      console.log(`  Вывод:  ${outputPath}`);
      console.log("=".repeat(60));

      const startTime = Date.now();

      console.log("\n📄 Извлечение текста из PDF...");
      const { text, totalPages } = await extractTextFromPdf(absolutePath);
      console.log(`   Извлечено ${totalPages} страниц(ы)`);

      const result = await analyzeBook({ text, model: opts.model, outputPath });

      await writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8");

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
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
      console.log("=".repeat(60));
    } catch (error) {
      console.error(
        "\nОшибка:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

program.parse();
