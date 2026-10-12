import { describe, expect, it } from "vitest";
import type { Entry } from "../types/book";
import { entryDescription, entryTitle } from "./entryLabels";

const base: Entry = {
  id: 1,
  name: "",
  enabled: true,
  activation: "always_on",
  characterId: null,
  personaId: null,
  alias: "",
  content: "Таверна у моста",
  keywords: [],
  keywordDepth: 4,
  characterName: null,
  characterHasImage: false,
  personaName: null,
  personaHasImage: false,
  sortOrder: 0,
};

describe("entryTitle", () => {
  it("своё имя важнее имени ссылки", () => {
    expect(entryTitle({ ...base, name: "Анна", characterId: 2, characterName: "Анна Карловна" })).toBe("Анна");
  });

  it("без имени — имя персонажа или персоны, иначе «Без названия»", () => {
    expect(entryTitle({ ...base, characterId: 2, characterName: "Борис" })).toBe("Борис");
    expect(entryTitle({ ...base, personaId: 3, personaName: "Странник" })).toBe("Странник");
    expect(entryTitle(base)).toBe("Без названия");
  });
});

describe("entryDescription", () => {
  it("свободный текст — сам текст, без пометки для «всегда»", () => {
    expect(entryDescription(base)).toBe("Таверна у моста");
  });

  it("ссылка на персонажа и удалённая ссылка", () => {
    expect(entryDescription({ ...base, characterId: 2, characterName: "Борис" })).toBe("Персонаж: Борис");
    expect(entryDescription({ ...base, personaId: 3 })).toBe("Персона: удалена");
  });

  it("статус: выключена важнее «по ключевым словам»", () => {
    expect(entryDescription({ ...base, activation: "keyword" })).toBe("по ключевым словам · Таверна у моста");
    expect(entryDescription({ ...base, activation: "keyword", enabled: false })).toBe("выключена · Таверна у моста");
  });
});
