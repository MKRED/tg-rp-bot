import { describe, expect, it } from "vitest";
import { applyHunks, blockPath, parseBlockPath, parsePatch, streamedPatchPaths, type PatchSection } from "./index.js";

// Патчи — дословно из проб на живом DeepSeek (deepseek-flash, Responses API, apply_patch).
const LOOK =
  "Лира — девушка 19 лет, невысокая и худощавая. У неё рыжие волосы до плеч, обычно собранные в небрежный хвост, " +
  "и зелёные глаза. На левой щеке — тонкий шрам от падения с мачты.";
const LIRA = "# Внешность\n- Рост: 158 см, худощавая\n- Волосы: рыжие, до плеч\n- Глаза: зелёные\n\n# Привычки\n- Грызёт карандаш, когда думает\n- Каждое утро сверяет компас с солнцем\n- Боится глубокой воды";
const ADA = "# Привычки\n- Спит с ножом под подушкой\n- Никогда не садится спиной к двери";

function sections(patch: string): PatchSection[] {
  const parsed = parsePatch(patch);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.sections;
}

function apply(text: string, patch: string): string {
  const result = applyHunks(text, sections(patch)[0]!.hunks);
  if (!result.ok) throw new Error(result.error);
  return result.text;
}

describe("apply_patch: патчи из проб", () => {
  it("фрагмент внутри строки-абзаца", () => {
    const patch = "*** Begin Patch\n*** Update File: cards/3/look.md\n@@\n-и зелёные глаза\n+и серые глаза\n*** End Patch";
    expect(apply(LOOK, patch)).toBe(LOOK.replace("и зелёные глаза", "и серые глаза"));
  });

  it("строка списка: срезается ровно один символ префикса", () => {
    const patch = "*** Begin Patch\n*** Update File: cards/3/main.md\n@@\n-- Глаза: зелёные\n+- Глаза: серые\n*** End Patch";
    expect(apply(LIRA, patch)).toBe(LIRA.replace("- Глаза: зелёные", "- Глаза: серые"));
  });

  it("вставка с контекстом", () => {
    const patch =
      "*** Begin Patch\n*** Update File: cards/4/main.md\n@@\n - Спит с ножом под подушкой\n+- Пересчитывает монеты перед сном\n - Никогда не садится спиной к двери\n*** End Patch";
    expect(apply(ADA, patch)).toBe(
      "# Привычки\n- Спит с ножом под подушкой\n- Пересчитывает монеты перед сном\n- Никогда не садится спиной к двери",
    );
  });

  it("удаление строки", () => {
    const patch =
      "*** Begin Patch\n*** Update File: cards/3/main.md\n@@\n - Грызёт карандаш, когда думает\n - Каждое утро сверяет компас с солнцем\n-- Боится глубокой воды\n*** End Patch";
    expect(apply(LIRA, patch)).toBe(LIRA.replace("\n- Боится глубокой воды", ""));
  });

  it("две секции в одном патче, перевод строки после End Patch", () => {
    const patch =
      "*** Begin Patch\n*** Update File: cards/3/main.md\n@@\n-- Глаза: зелёные\n+- Глаза: серые\n" +
      "*** Update File: cards/4/main.md\n@@\n-- Глаза: зелёные, как у сестры\n+- Глаза: серые, как у сестры\n*** End Patch\n";
    expect(sections(patch)).toEqual([
      { path: "cards/3/main.md", hunks: [{ old: "- Глаза: зелёные", new: "- Глаза: серые" }] },
      { path: "cards/4/main.md", hunks: [{ old: "- Глаза: зелёные, как у сестры", new: "- Глаза: серые, как у сестры" }] },
    ]);
  });
});

describe("parsePatch: терпимость и ошибки", () => {
  it("без End Patch и без @@; пустая строка перед следующей секцией не входит в ханк", () => {
    expect(sections("*** Begin Patch\n*** Update File: a\n-x\n+y\n\n*** Update File: b\n@@\n-p\n+q")).toEqual([
      { path: "a", hunks: [{ old: "x", new: "y" }] },
      { path: "b", hunks: [{ old: "p", new: "q" }] },
    ]);
  });

  it("несколько ханков в секции; контекст без пробела-префикса", () => {
    expect(sections("*** Begin Patch\n*** Update File: a\n@@\nA\n-B\n+b\n@@\n-C\n+c\n*** End Patch")[0]!.hunks).toEqual([
      { old: "A\nB", new: "A\nb" },
      { old: "C", new: "c" },
    ]);
  });

  it("создание, удаление, переименование и мусор — ошибки с подсказкой", () => {
    expect(parsePatch("hello")).toMatchObject({ ok: false });
    expect(parsePatch("*** Begin Patch\n*** Add File: cards/3/x.md\n+hi")).toMatchObject({ ok: false, error: expect.stringContaining("edit_block") });
    expect(parsePatch("*** Begin Patch\n*** Delete File: cards/3/x.md")).toMatchObject({ ok: false });
    expect(parsePatch("*** Begin Patch\n*** Update File: a\n*** Move to: b\n-x\n+y")).toMatchObject({ ok: false });
    expect(parsePatch("*** Begin Patch\n*** End Patch")).toMatchObject({ ok: false });
    expect(parsePatch("*** Begin Patch\n*** Update File: a\n@@\n same\n*** End Patch")).toMatchObject({ ok: false, error: expect.stringContaining("no changes") });
  });
});

describe("applyHunks", () => {
  it("фрагмент не найден или встречается дважды — ошибка", () => {
    expect(applyHunks("abc", [{ old: "zzz", new: "y" }])).toMatchObject({ ok: false, error: expect.stringContaining("not found") });
    expect(applyHunks("- a\n- a", [{ old: "- a", new: "- b" }])).toMatchObject({ ok: false, error: expect.stringContaining("2 times") });
  });

  it("лишние пробелы по краям фрагмента прощаются", () => {
    expect(applyHunks("один два три", [{ old: " два ", new: " 2 " }])).toEqual({ ok: true, text: "один 2 три" });
    expect(applyHunks("line one\nline two", [{ old: "line two\n", new: "line 2\n" }])).toEqual({ ok: true, text: "line one\nline 2" });
  });

  it("только + : заполняет пустой блок, в непустом — ошибка", () => {
    expect(applyHunks("", [{ old: "", new: "Новый текст" }])).toEqual({ ok: true, text: "Новый текст" });
    expect(applyHunks("есть текст", [{ old: "", new: "x" }])).toMatchObject({ ok: false });
  });

  it("$ в замене — не шаблон replace", () => {
    expect(applyHunks("цена: X", [{ old: "X", new: "$1 и $&" }])).toEqual({ ok: true, text: "цена: $1 и $&" });
  });
});

describe("пути блоков", () => {
  it("туда и обратно; терпит ./ и отсутствие .md", () => {
    expect(blockPath(3, "look")).toBe("cards/3/look.md");
    expect(parseBlockPath("cards/3/look.md")).toEqual({ cardId: 3, blockId: "look" });
    expect(parseBlockPath("./cards/12/cat_1")).toEqual({ cardId: 12, blockId: "cat_1" });
    expect(parseBlockPath("notes/3/look.md")).toBeUndefined();
  });

  it("стримящийся патч — только законченные строки путей", () => {
    expect(streamedPatchPaths("*** Begin Patch\n*** Update File: cards/3/look.md\n@@\n-x\n*** Update File: cards/4/ma")).toEqual([
      "cards/3/look.md",
    ]);
  });
});
