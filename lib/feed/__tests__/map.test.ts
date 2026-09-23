import assert from "node:assert/strict";
import { test } from "node:test";
import { excerpt, mapFeedRow, type FeedRow } from "../map";

const book = {
  id: "b1",
  title: "T",
  authors: "A",
  thumbnailUrl: null,
  description: "Описание книги",
};
const actor = { id: "u1", name: "User", image: null };
const image = {
  id: "img1",
  blobUrl: "https://x/1.png",
  _count: { likes: 2, comments: 1 },
  comments: [{ content: "wow", user: { name: "N", image: null } }],
};
const base = {
  id: "f1",
  createdAt: new Date("2026-09-22T10:00:00.000Z"),
  actor,
  book,
  cover: null,
  characterImage: null,
  post: null,
};

test("cover → kind cover с payload картинки", () => {
  const item = mapFeedRow({ ...base, type: "COVER", cover: image } as FeedRow)!;
  assert.equal(item.kind, "cover");
  if (item.kind !== "cover") return;
  assert.equal(item.cover.likesCount, 2);
  assert.equal(item.cover.lastComment?.content, "wow");
  assert.equal(item.cover.isLiked, false);
  assert.equal(item.createdAt, "2026-09-22T10:00:00.000Z");
  assert.ok(!("description" in item.book));
});

test("character image → kind character_image с персонажем", () => {
  const item = mapFeedRow({
    ...base,
    type: "CHARACTER_IMAGE",
    characterImage: { ...image, character: { id: "c1", name: "Geralt" } },
  } as FeedRow)!;
  assert.equal(item.kind, "character_image");
  if (item.kind === "character_image")
    assert.equal(item.image.character.name, "Geralt");
});

test("book added → системная карточка без актора и с excerpt", () => {
  const item = mapFeedRow({
    ...base,
    actor: null,
    type: "BOOK_ADDED",
  } as FeedRow)!;
  assert.equal(item.kind, "book_added");
  assert.equal(item.actor, null);
  if (item.kind === "book_added") assert.equal(item.excerpt, "Описание книги");
});

test("post → contentHtml и персонаж", () => {
  const item = mapFeedRow({
    ...base,
    type: "POST",
    post: { id: "p1", content: "<p>hi</p>", character: null },
  } as FeedRow)!;
  assert.equal(item.kind, "post");
  if (item.kind === "post") assert.equal(item.post.contentHtml, "<p>hi</p>");
});

test("строка без payload пропускается", () => {
  assert.equal(mapFeedRow({ ...base, type: "COVER" } as FeedRow), null);
  assert.equal(mapFeedRow({ ...base, type: "POST" } as FeedRow), null);
});

test("excerpt режет по слову и ставит многоточие", () => {
  assert.equal(excerpt(null), null);
  assert.equal(excerpt("  "), null);
  assert.equal(excerpt("короткий"), "короткий");
  const long = Array.from({ length: 60 }, (_, i) => `слово${i}`).join(" ");
  const cut = excerpt(long)!;
  assert.ok(cut.endsWith("…"));
  assert.ok(cut.length <= 241);
  assert.ok(!cut.slice(0, -1).endsWith(" "));
});
