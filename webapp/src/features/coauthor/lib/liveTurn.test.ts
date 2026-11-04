import { describe, expect, it } from "vitest";
import type { CoauthorStep } from "../types/coauthor";
import { appendLiveText, liveShowsActivity, resetLiveAttempt, upsertLiveStep, type LiveItem } from "./liveTurn";

const running: CoauthorStep = { id: "e1", status: "running", kind: "edit", cardId: 1, blockId: "fears" };
const done: CoauthorStep = { ...running, status: "done" };

describe("liveTurn", () => {
  it("текст дописывается к последнему куску, а после шага начинается новый", () => {
    let items = appendLiveText(appendLiveText([], "Hel"), "lo");
    expect(items).toEqual([{ type: "text", text: "Hello" }]);
    items = upsertLiveStep(items, running);
    items = appendLiveText(items, "Next");
    expect(items.map((i) => i.type)).toEqual(["text", "steps", "text"]);
  });

  it("шаг с тем же id обновляется на месте, даже если после него уже был текст", () => {
    const items = appendLiveText(upsertLiveStep([], running), "Text");
    expect(upsertLiveStep(items, done)).toEqual([
      { type: "steps", steps: [done] },
      { type: "text", text: "Text" },
    ]);
  });

  it("соседние шаги идут одним списком", () => {
    const second: CoauthorStep = { id: "s1", status: "running", kind: "search", query: "q" };
    expect(upsertLiveStep(upsertLiveStep([], running), second)).toEqual([{ type: "steps", steps: [running, second] }]);
  });

  it("сброс убирает незавершённые шаги и текст текущей попытки, готовое остаётся", () => {
    const items: LiveItem[] = [
      { type: "steps", steps: [done, { id: "s1", status: "running", kind: "search", query: "q" }] },
      { type: "text", text: "partial" },
    ];
    expect(resetLiveAttempt(items)).toEqual([{ type: "steps", steps: [done] }]);
  });

  it("индикатор «думает» нужен, когда ничего не идёт", () => {
    expect(liveShowsActivity([])).toBe(false);
    expect(liveShowsActivity([{ type: "steps", steps: [done] }])).toBe(false);
    expect(liveShowsActivity([{ type: "steps", steps: [running] }])).toBe(true);
    expect(liveShowsActivity([{ type: "text", text: "x" }])).toBe(true);
  });
});
