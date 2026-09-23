import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createJobRequestSchema,
  modelNameSchema,
  pdfFilenameSchema,
  publishRequestSchema,
  resolveBookPdf,
  resolveGeneratedJson,
} from "../api-schemas";

test("имя PDF: только файл .pdf без путей", () => {
  assert.ok(pdfFilenameSchema.safeParse("book.pdf").success);
  assert.ok(
    pdfFilenameSchema.safeParse("(Witcher 1)The Last Wish.PDF").success,
  );
  for (const bad of [
    "../x.pdf",
    "dir/book.pdf",
    "book.txt",
    "",
    "..",
    "C:\\x.pdf",
  ]) {
    assert.equal(pdfFilenameSchema.safeParse(bad).success, false, bad);
  }
});

test("имя модели: допустимые и недопустимые", () => {
  for (const ok of [
    "deepseek-v4.1-flash",
    "qwen3.5:latest",
    "claude-sonnet-5",
    "org/model:tag",
  ]) {
    assert.ok(modelNameSchema.safeParse(ok).success, ok);
  }
  for (const bad of ["", "../evil", "model name", "x".repeat(70), "-leading"]) {
    assert.equal(modelNameSchema.safeParse(bad).success, false, bad);
  }
});

test("создание задачи: границы chunkTokens и опциональные поля", () => {
  const base = { pdf: "book.pdf", model: "deepseek-v4.1-flash" };
  assert.ok(createJobRequestSchema.safeParse(base).success);
  assert.ok(
    createJobRequestSchema.safeParse({
      ...base,
      chunkTokens: 100_000,
      fresh: true,
    }).success,
  );
  assert.equal(
    createJobRequestSchema.safeParse({ ...base, chunkTokens: 1_000 }).success,
    false,
  );
  assert.equal(
    createJobRequestSchema.safeParse({ ...base, chunkTokens: 2_000_000 })
      .success,
    false,
  );
  assert.equal(
    createJobRequestSchema.safeParse({ ...base, chunkTokens: 100.5 }).success,
    false,
  );
  assert.equal(createJobRequestSchema.safeParse({ model: "x" }).success, false);
});

test("публикация: путь обязателен, флаги булевы", () => {
  assert.ok(
    publishRequestSchema.safeParse({
      jsonPath: "lib/analyzer/generated/a.analysis.json",
      dryRun: true,
    }).success,
  );
  assert.equal(publishRequestSchema.safeParse({}).success, false);
  assert.equal(
    publishRequestSchema.safeParse({ jsonPath: "x", skipImages: "yes" })
      .success,
    false,
  );
});

test("resolveBookPdf не выпускает за пределы каталога книг", () => {
  assert.throws(
    () => resolveBookPdf("../../package.json"),
    /не найден|вне каталога/,
  );
  assert.throws(() => resolveBookPdf("nope.pdf"), /не найден/);
});

test("resolveGeneratedJson принимает только .analysis.json внутри generated", () => {
  assert.throws(() => resolveGeneratedJson("package.json"), /вне каталога/);
  assert.throws(
    () => resolveGeneratedJson("lib/analyzer/generated/x.json"),
    /analysis\.json/,
  );
  assert.match(
    resolveGeneratedJson("lib/analyzer/generated/x.analysis.json"),
    /generated\/x\.analysis\.json$/,
  );
});
