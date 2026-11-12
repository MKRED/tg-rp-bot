import { describe, expect, it } from "vitest";
import type { CoauthorCard } from "../types/coauthor";
import { stepLabel } from "./steps";

const cards = [{ id: 1, name: "Елена", blocks: [{ id: "fears", title: "Страхи", content: "" }] }] as unknown as CoauthorCard[];

describe("stepLabel", () => {
  it("правка: пока пишется и когда готова", () => {
    const step = { id: "e", kind: "edit", cardId: 1, blockId: "fears" } as const;
    expect(stepLabel({ ...step, status: "running" }, cards)).toBe("Пишет правку: Елена · Страхи");
    expect(stepLabel({ ...step, status: "done" }, cards)).toBe("Правка: Елена · Страхи");
  });

  it("правка удалённой карточки не ломает подпись", () => {
    expect(stepLabel({ id: "e", status: "done", kind: "edit", cardId: 9, blockId: "x" }, cards)).toBe("Правка: блок удалён");
  });

  it("чтение карточки называет её", () => {
    expect(stepLabel({ id: "c", status: "running", kind: "card", cardId: 1 }, cards)).toBe("Читает карточку: Елена");
    expect(stepLabel({ id: "c", status: "done", kind: "card", cardId: 9 }, cards)).toBe("Прочитана карточка: карточка убрана из чата");
  });

  it("поиск показывает запрос", () => {
    expect(stepLabel({ id: "s", status: "running", kind: "search", query: "канон" }, cards)).toBe("Ищет в интернете: «канон»");
  });
});
