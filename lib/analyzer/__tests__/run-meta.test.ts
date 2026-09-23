import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { metaPathFor, readAnalysisMeta, writeAnalysisMeta } from "../run";

test("сайдкар .meta.json лежит рядом с .analysis.json и читается обратно", async () => {
  const dir = await mkdtemp(join(tmpdir(), "analyzer-meta-"));
  try {
    const output = join(dir, "book.c100k.analysis.json");
    assert.equal(metaPathFor(output), join(dir, "book.c100k.meta.json"));

    const written = await writeAnalysisMeta(
      output,
      {
        pdfPath: "books/book.pdf",
        model: "m",
        chunkTokens: 100_000,
        bookSeriesId: "s1",
        title: "T",
      },
      [],
      1234,
    );
    const raw = JSON.parse(await readFile(metaPathFor(output), "utf-8"));
    assert.equal(raw.model, "m");
    assert.equal(raw.bookSeriesId, "s1");
    assert.equal(raw.chunkTokens, 100_000);
    assert.ok(!Number.isNaN(Date.parse(written.createdAt)));

    const back = await readAnalysisMeta(output);
    assert.deepEqual(back, written);
    assert.equal(
      await readAnalysisMeta(join(dir, "missing.analysis.json")),
      null,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
