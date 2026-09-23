import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cursorToSearchParams,
  cursorWhere,
  feedCursorSchema,
  parseCursor,
} from "../cursor";

test("схема курсора принимает ISO-дату и id, отвергает мусор", () => {
  assert.ok(
    feedCursorSchema.safeParse({
      createdAt: "2026-09-22T10:00:00.000Z",
      id: "abc",
    }).success,
  );
  assert.equal(
    feedCursorSchema.safeParse({ createdAt: "вчера", id: "abc" }).success,
    false,
  );
  assert.equal(
    feedCursorSchema.safeParse({
      createdAt: "2026-09-22T10:00:00.000Z",
      id: "",
    }).success,
    false,
  );
});

test("cursorWhere: без курсора нет условия, с курсором keyset по (createdAt, id)", () => {
  assert.equal(cursorWhere(undefined), undefined);
  const where = cursorWhere({
    createdAt: "2026-09-22T10:00:00.000Z",
    id: "k",
  })!;
  const date = new Date("2026-09-22T10:00:00.000Z");
  assert.deepEqual(where, {
    OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: "k" } }],
  });
});

test("parseCursor: первая страница без параметров, ошибка при частичном курсоре, roundtrip", () => {
  assert.deepEqual(parseCursor(new URLSearchParams()), { cursor: undefined });
  assert.deepEqual(
    parseCursor(new URLSearchParams({ after: "2026-09-22T10:00:00.000Z" })),
    { error: "Invalid cursor" },
  );
  const cursor = { createdAt: "2026-09-22T10:00:00.000Z", id: "k1" };
  assert.deepEqual(parseCursor(cursorToSearchParams(cursor)), { cursor });
});
