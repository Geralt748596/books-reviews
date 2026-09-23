import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAliasGroups, type MergedCharacter } from "../analyzer";
import type { ChunkEvent } from "../types";

function mc(
  name: string,
  aliases: string[] = [],
  mentionCount = 1,
): MergedCharacter {
  return {
    name,
    aliases,
    appearance: "",
    personality: "",
    appearanceFragments: [],
    personalityFragments: [],
    descriptionFragments: [`about ${name}`],
    mentionCount,
  };
}

const together = (...names: string[]): ChunkEvent => ({
  summary: "scene",
  charactersInvolved: names,
});

test("high-группа с лексической связью сливается даже при совместной сцене", () => {
  const merged = [
    mc("Urcheon of Erlenwald", ["Duny"], 2),
    mc("Duny", [], 1),
    mc("Geralt"),
  ];
  const result = applyAliasGroups(
    merged,
    [
      {
        canonicalName: "Urcheon of Erlenwald",
        members: ["Urcheon of Erlenwald", "Duny"],
        confidence: "high",
        evidence: "",
      },
    ],
    [together("Urcheon of Erlenwald", "Duny", "Geralt")],
  );
  assert.deepEqual(
    result.map((m) => m.name),
    ["Urcheon of Erlenwald", "Geralt"],
  );
  assert.ok(result[0].aliases.includes("Duny"));
  assert.equal(result[0].mentionCount, 3);
  assert.equal(result[0].descriptionFragments.length, 2);
});

test("совместная сцена без лексической связи блокирует слияние", () => {
  const merged = [mc("Ostrit"), mc("Segelin")];
  const result = applyAliasGroups(
    merged,
    [
      {
        canonicalName: "Ostrit",
        members: ["Ostrit", "Segelin"],
        confidence: "high",
        evidence: "",
      },
    ],
    [together("Ostrit", "Segelin")],
  );
  assert.equal(result.length, 2);
});

test("уверенность ниже high и одиночные группы не сливают ничего", () => {
  const merged = [
    mc("Zatret Voruta"),
    mc("Zatreta Voruta"),
    mc("Geralt", ["Geralt of Rivia"]),
  ];
  const result = applyAliasGroups(
    merged,
    [
      {
        canonicalName: "Zatret Voruta",
        members: ["Zatret Voruta", "Zatreta Voruta"],
        confidence: "medium",
        evidence: "",
      },
      {
        canonicalName: "Geralt",
        members: ["Geralt"],
        confidence: "high",
        evidence: "",
      },
    ],
    [],
  );
  assert.equal(result.length, 3);
});

test("канонику берём из группы, порядок исходного списка сохраняется", () => {
  const merged = [
    mc("Geralt", [], 5),
    mc("Yennefer"),
    mc("Geralt of Rivia", ["Geralt"], 2),
  ];
  const result = applyAliasGroups(
    merged,
    [
      {
        canonicalName: "Geralt of Rivia",
        members: ["Geralt", "Geralt of Rivia"],
        confidence: "high",
        evidence: "",
      },
    ],
    [],
  );
  assert.deepEqual(
    result.map((m) => m.name),
    ["Geralt of Rivia", "Yennefer"],
  );
  assert.ok(result[0].aliases.includes("Geralt"));
});
