import { describe, expect, it } from "vitest";
import {
  applySyncResults,
  buildInitialBlocks,
  dirtyIndices,
  hasDirty,
  joinSegments,
  joinSource,
  joinTranslation,
  mergeTranslated,
  realignBlocks,
  splitIntoSegments,
  splitTranslatable,
  type TranslateBlock,
} from "./translateBlocks";

describe("splitIntoSegments / joinSegments — lossless round-trip", () => {
  it("empty text", () => {
    expect(splitIntoSegments("")).toEqual([]);
    expect(joinSegments(splitIntoSegments(""))).toBe("");
  });

  it("no blank lines at all — one block", () => {
    const text = "Name: X\nAge: Y\nRace: Elf";
    const segments = splitIntoSegments(text);
    expect(segments).toHaveLength(1);
    expect(joinSegments(segments)).toBe(text);
  });

  it("mixed blank-line counts between paragraphs", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\n\nThird paragraph.";
    const segments = splitIntoSegments(text);
    expect(segments).toHaveLength(3);
    expect(joinSegments(segments)).toBe(text);
  });

  it("leading and trailing blank lines", () => {
    const text = "\n\nStart.\n\nEnd.\n\n";
    expect(joinSegments(splitIntoSegments(text))).toBe(text);
  });

  it("CRLF line endings", () => {
    const text = "Para one.\r\n\r\nPara two.\r\n\r\nPara three.";
    const segments = splitIntoSegments(text);
    expect(segments).toHaveLength(3);
    expect(joinSegments(segments)).toBe(text);
  });

  it("arbitrary text is always lossless", () => {
    const samples = [
      "single line",
      "a\n\nb\n\nc",
      "\n\n\n\n",
      "trailing newline\n\n",
      "a\nb\nc\n\nd\ne",
    ];
    for (const text of samples) {
      expect(joinSegments(splitIntoSegments(text))).toBe(text);
    }
  });
});

describe("buildInitialBlocks", () => {
  it("zips segments 1:1 with translations, marking both sides synced", () => {
    const source = "Alpha.\n\nBeta.\n\nGamma.";
    const blocks = buildInitialBlocks(source, ["Альфа.", "Бета.", "Гамма."]);
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => b.source)).toEqual(["Alpha.", "Beta.", "Gamma."]);
    expect(blocks.map((b) => b.translation)).toEqual(["Альфа.", "Бета.", "Гамма."]);
    for (const b of blocks) {
      expect(b.source).toBe(b.sourceAtLastSync);
      expect(b.translation).toBe(b.translationAtLastSync);
    }
    expect(joinSource(blocks)).toBe(source);
  });

  it("empty source produces no blocks", () => {
    expect(buildInitialBlocks("", [])).toEqual([]);
  });
});

describe("splitTranslatable / mergeTranslated", () => {
  it("filters blank segments out of the translation request and restores them verbatim", () => {
    // a whitespace-only paragraph between two real ones (surrounded by proper blank-line breaks)
    const text = "Alpha.\n\n \n\nBeta.";
    const segments = splitIntoSegments(text);
    expect(segments.some((s) => s.content.trim() === "")).toBe(true);

    const split = splitTranslatable(segments);
    expect(split.texts).toEqual(["Alpha.", "Beta."]);

    const merged = mergeTranslated(segments, split, ["Альфа.", "Бета."]);
    expect(merged).toHaveLength(segments.length);
    expect(merged.filter((t) => t.trim() !== "")).toEqual(["Альфа.", "Бета."]);
    expect(merged[1]).toBe(" "); // blank segment passed through untouched, no network call needed
  });
});

describe("realignBlocks", () => {
  function blocksFrom(text: string, translations: string[]): TranslateBlock[] {
    return buildInitialBlocks(text, translations);
  }

  it("no edits — nothing dirty", () => {
    const blocks = blocksFrom("A.\n\nB.\n\nC.", ["А.", "Б.", "В."]);
    const realigned = realignBlocks(blocks, joinTranslation(blocks), "translation");
    expect(dirtyIndices(realigned, "translation")).toEqual([]);
    expect(realigned.map((b) => b.id)).toEqual(blocks.map((b) => b.id));
  });

  it("editing one paragraph marks only that one dirty", () => {
    const blocks = blocksFrom("A.\n\nB.\n\nC.", ["А.", "Б.", "В."]);
    const edited = "А.\n\nБ. edited\n\nВ.";
    const realigned = realignBlocks(blocks, edited, "translation");
    const dirty = dirtyIndices(realigned, "translation");
    expect(dirty).toEqual([1]);
    expect(realigned[0]!.id).toBe(blocks[0]!.id);
    expect(realigned[2]!.id).toBe(blocks[2]!.id);
  });

  it("inserting a paragraph at the top keeps the rest clean (LCS, not index-based)", () => {
    const blocks = blocksFrom("A.\n\nB.\n\nC.", ["А.", "Б.", "В."]);
    const edited = "Новый первый абзац.\n\nА.\n\nБ.\n\nВ.";
    const realigned = realignBlocks(blocks, edited, "translation");
    expect(realigned).toHaveLength(4);
    // only the inserted paragraph is dirty — the three original ones must be recognized as unchanged
    expect(dirtyIndices(realigned, "translation")).toEqual([0]);
    expect(realigned[1]!.id).toBe(blocks[0]!.id);
    expect(realigned[2]!.id).toBe(blocks[1]!.id);
    expect(realigned[3]!.id).toBe(blocks[2]!.id);
  });

  it("deleting a paragraph drops it without marking others dirty", () => {
    const blocks = blocksFrom("A.\n\nB.\n\nC.", ["А.", "Б.", "В."]);
    const edited = "А.\n\nВ.";
    const realigned = realignBlocks(blocks, edited, "translation");
    expect(realigned).toHaveLength(2);
    expect(dirtyIndices(realigned, "translation")).toEqual([]);
    expect(realigned[0]!.id).toBe(blocks[0]!.id);
    expect(realigned[1]!.id).toBe(blocks[2]!.id);
  });

  it("inserting a brand-new paragraph in the middle", () => {
    const blocks = blocksFrom("A.\n\nB.", ["А.", "Б."]);
    const edited = "А.\n\nНовый.\n\nБ.";
    const realigned = realignBlocks(blocks, edited, "translation");
    expect(realigned).toHaveLength(3);
    expect(dirtyIndices(realigned, "translation")).toEqual([1]);
  });

  it("reordering two paragraphs is safe (no cross-wiring), even if not minimal", () => {
    const blocks = blocksFrom("First.\n\nSecond.", ["Первый.", "Второй."]);
    const edited = "Второй.\n\nПервый.";
    const realigned = realignBlocks(blocks, edited, "translation");
    expect(realigned).toHaveLength(2);
    expect(joinTranslation(realigned)).toBe(edited);
    // no fabricated pairing: every block's source (if carried over from a prior block) must be the
    // ORIGINAL source that produced this exact translation, never the other paragraph's source
    for (const b of realigned) {
      if (b.source === "First.") expect(b.translation).toBe("Первый.");
      if (b.source === "Second.") expect(b.translation).toBe("Второй.");
    }
  });

  it("realigning an emptied buffer marks everything dirty, not silently clean", () => {
    const blocks = blocksFrom("A.\n\nB.", ["А.", "Б."]);
    const realigned = realignBlocks(blocks, "", "translation");
    expect(realigned).toEqual([]);
  });

  it("syncing from scratch (empty prevBlocks) treats all text as new — compose-new-text scenario", () => {
    const realigned = realignBlocks([], "Написанный с нуля текст.\n\nВторой абзац.", "translation");
    expect(realigned).toHaveLength(2);
    expect(dirtyIndices(realigned, "translation")).toEqual([0, 1]);
    expect(realigned.every((b) => b.source === "")).toBe(true);
  });

  it("works symmetrically for the source side", () => {
    const blocks = blocksFrom("A.\n\nB.", ["А.", "Б."]);
    const edited = "A.\n\nB.\n\nNew paragraph.";
    const realigned = realignBlocks(blocks, edited, "source");
    expect(dirtyIndices(realigned, "source")).toEqual([2]);
    expect(realigned[2]!.translation).toBe("");
  });
});

describe("applySyncResults", () => {
  it("only touches dirty blocks; untouched blocks stay the exact same reference", () => {
    const blocks = buildInitialBlocks("A.\n\nB.\n\nC.", ["А.", "Б.", "В."]);
    const edited = "A.\n\nB edited.\n\nC.";
    const realigned = realignBlocks(blocks, edited, "source");
    const dirty = dirtyIndices(realigned, "source");
    expect(dirty).toEqual([1]);

    const applied = applySyncResults(realigned, "source", dirty, ["Б изменено."]);
    expect(applied[0]).toBe(realigned[0]); // same reference — never re-derived
    expect(applied[2]).toBe(realigned[2]);
    expect(applied[1]!.translation).toBe("Б изменено.");
    expect(applied[1]!.translationAtLastSync).toBe("Б изменено.");
    expect(hasDirty(applied, "source")).toBe(false);
  });
});

// Симулирует именно те вычисления, которые usePromptTranslate.ts делает на каждый рендер для
// guard'ов canSyncToTranslation/canSyncToSource. blocks сидируется РЕАЛЬНЫМ source уже при
// монтировании (realignBlocks([], sourceText, "source")), а не blocks=[] — см. большой коммент
// в usePromptTranslate.ts. Это не устраняет блокировку синка в КАЖДОМ сценарии с двусторонней
// правкой (см. второй тест ниже — блокировка там КОРРЕКТНА, снятие её привело бы к молчаливой
// потере абзацев исходника), а чинит конкретно "написать новое с нуля" на ПУСТОМ поле — самый
// частый и явно заявленный сценарий использования.
describe("two-sided pending detection (usePromptTranslate guard)", () => {
  function seed(sourceText: string): TranslateBlock[] {
    return realignBlocks([], sourceText, "source");
  }
  function pending(blocks: TranslateBlock[], text: string, side: "source" | "translation") {
    return hasDirty(realignBlocks(blocks, text, side), side);
  }

  it("composing brand-new text in an empty translation buffer, on an EMPTY source field, is never blocked", () => {
    const blocks = seed(""); // новое поле, ничего не заполнено
    const sourcePending = pending(blocks, "", "source");
    const translationPending = pending(blocks, "Свежий текст, написанный с нуля.", "translation");

    expect(sourcePending).toBe(false); // источник пуст — синкать вперёд нечего, но и мешать некому
    expect(translationPending).toBe(true); // есть новый текст, который нужно перенести в оригинал
    const canSyncToSource = translationPending && !sourcePending;
    expect(canSyncToSource).toBe(true); // ничем не заблокировано — ключевой сценарий из задачи работает
  });

  it("composing brand-new text while a NON-empty, never-synced source still exists correctly stays blocked", () => {
    // Три абзаца исходника, ни разу не переведённого, пользователь сразу пишет новый текст в
    // пустой перевод, не синкнув сначала. Если бы канSyncToSource здесь разрешался, синк
    // молчаливо ВЫКИНУЛ БЫ все три абзаца исходника (они не представлены в живом translation-
    // тексте и попали бы в "removed" при реалайне) — заблокировано намеренно, не баг.
    const blocks = seed("Para1.\n\nPara2.\n\nPara3.");
    const sourcePending = pending(blocks, "Para1.\n\nPara2.\n\nPara3.", "source");
    const translationPending = pending(blocks, "Новый абзац.", "translation");

    expect(sourcePending).toBe(true); // исходник ещё ни разу не переводился — есть что синкать вперёд
    expect(translationPending).toBe(true); // и в переводе есть новый, ещё не перенесённый текст
    const canSyncToSource = translationPending && !sourcePending;
    const canSyncToTranslation = sourcePending && !translationPending;
    expect(canSyncToSource).toBe(false);
    expect(canSyncToTranslation).toBe(false);
    // Выход у пользователя есть: переключиться на «Оригинал» (там Clear не задизейблен) и явно
    // очистить старый исходник — тогда sourcePending станет false и синк разблокируется.
  });

  it("editing only the translation side after a real sync leaves the source side clean", () => {
    const blocks = seed("Original text.");
    // Первый синк вперёд.
    const afterFirstSync = applySyncResults(
      realignBlocks(blocks, "Original text.", "source"),
      "source",
      [0],
      ["Переведённый текст."],
    );
    expect(pending(afterFirstSync, "Original text.", "source")).toBe(false);
    expect(pending(afterFirstSync, "Переведённый текст.", "translation")).toBe(false);

    // Пользователь правит только перевод.
    const editedTranslation = "Переведённый текст, отредактированный.";
    expect(pending(afterFirstSync, "Original text.", "source")).toBe(false); // source не тронут
    expect(pending(afterFirstSync, editedTranslation, "translation")).toBe(true); // перевод — да
  });
});
