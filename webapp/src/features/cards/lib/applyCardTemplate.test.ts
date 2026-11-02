import type { CardCategory, CardField } from "@tg-rp-bot/shared";
import { describe, expect, it } from "vitest";
import { applyCardTemplate, templateConfirmMessage } from "./applyCardTemplate";

const cat = (id: string, title: string, content = "", extra: Partial<CardCategory> = {}): CardCategory => ({
  id,
  title,
  description: `d-${id}`,
  content,
  enabled: true,
  ...extra,
});
const field = (id: string, title: string, enabled = true): CardField => ({ id, title, description: `t-${id}`, enabled });

function idGen() {
  let n = 0;
  return () => `new-${++n}`;
}

describe("applyCardTemplate", () => {
  it("совпадение по названию без учёта регистра сохраняет id, текст и контекст; формат — из шаблона", () => {
    const answers = [{ question: "q", answer: "a" }];
    const current = [cat("base", "Base", "Имя: Ли", { askUserAnswers: answers })];
    const plan = applyCardTemplate(current, [field("x", " base ", false)], idGen());
    expect(plan.categories).toEqual([
      { id: "base", title: " base ", description: "t-x", enabled: false, content: "Имя: Ли", askUserAnswers: answers },
    ]);
    expect(plan.kept).toEqual([" base "]);
    expect(plan.lostWithText).toEqual([]);
  });

  it("новые поля — пустые, со свежим id (не id шаблона)", () => {
    const plan = applyCardTemplate([cat("body", "Body")], [field("body", "Magic")], idGen());
    expect(plan.categories).toEqual([{ id: "new-1", title: "Magic", description: "t-body", enabled: true, content: "" }]);
  });

  it("порядок — как в шаблоне", () => {
    const current = [cat("a", "A"), cat("b", "B")];
    const plan = applyCardTemplate(current, [field("1", "B"), field("2", "A")], idGen());
    expect(plan.categories.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("одноимённые поля шаблона не делят одну категорию — id не дублируются", () => {
    const plan = applyCardTemplate([cat("a", "Notes", "текст")], [field("1", "Notes"), field("2", "Notes")], idGen());
    expect(plan.categories.map((c) => c.id)).toEqual(["a", "new-1"]);
    expect(plan.categories[1]!.content).toBe("");
  });

  it("пустое название ни с чем не совпадает", () => {
    const plan = applyCardTemplate([cat("a", "", "текст")], [field("1", "")], idGen());
    expect(plan.categories[0]!.id).toBe("new-1");
    expect(plan.lostWithText).toEqual(["Без названия"]);
  });

  it("теряемые — только категории с текстом, которых нет в шаблоне", () => {
    const current = [cat("a", "A", "текст"), cat("b", "B"), cat("c", "C", "  ")];
    const plan = applyCardTemplate(current, [field("1", "Z")], idGen());
    expect(plan.lostWithText).toEqual(["A"]);
    expect(plan.kept).toEqual([]);
  });
});

describe("templateConfirmMessage", () => {
  it("называет сохраняемые и теряемые поля, длинные списки сокращает", () => {
    const message = templateConfirmMessage({ categories: [], kept: ["Base"], lostWithText: ["A", "B", "C", "D", "E"] });
    expect(message).toBe(
      "Системный промпт, поля и инструменты заменятся шаблонными. Текст сохранится: Base. Удалится вместе с текстом: A, B, C и ещё 2.",
    );
  });

  it("не длиннее лимита нативного попапа", () => {
    const long = "Очень длинное название поля ".repeat(10);
    const message = templateConfirmMessage({ categories: [], kept: [long, long, long], lostWithText: [long] });
    expect(message.length).toBeLessThanOrEqual(256);
  });
});
