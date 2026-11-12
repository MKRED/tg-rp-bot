import type { CoauthorProposal } from "@tg-rp-bot/shared";
import { describe, expect, it } from "vitest";
import type { CoauthorCardData } from "../prompt.js";
import { emptyCoauthorState, type StoredMessage } from "../state.js";
import { cardVersion, loadedCardIds, openTurnWithCardList, renderCard, replayCardResults } from "./index.js";

const elena: CoauthorCardData = { id: 1, name: "Elena", brief: "", images: [], blocks: [{ id: "fears", title: "Fears", format: "", content: "Storms" }] };
const mira: CoauthorCardData = { id: 2, name: "Mira", brief: "", images: [], blocks: [{ id: "fears", title: "Fears", format: "", content: "" }] };

const proposal = (status: CoauthorProposal["status"], id = "p1"): CoauthorProposal => ({
  id, cardId: 1, blockId: "fears", content: "Deep water", baseContent: "Storms", status,
});

const read = (id: string, cardId: number, content: string): StoredMessage[] => [
  { role: "assistant", content: null, toolCalls: [{ id, type: "function", function: { name: "get_card", arguments: `{"card_id":${cardId}}` } }] },
  { role: "tool", toolCallId: id, content },
];

describe("cardVersion", () => {
  it("своя ожидающая правка модели версию не меняет, решение пользователя — меняет", () => {
    const base = cardVersion(elena, []);
    expect(cardVersion(elena, [proposal("pending")])).toBe(base);
    expect(cardVersion(elena, [proposal("superseded")])).toBe(base);
    expect(cardVersion(elena, [proposal("rejected")])).not.toBe(base);
  });

  it("меняется вместе с текстом блоков и картинками", () => {
    const base = cardVersion(elena, []);
    expect(cardVersion({ ...elena, blocks: [{ ...elena.blocks[0]!, content: "Fire" }] }, [])).not.toBe(base);
    expect(cardVersion({ ...elena, images: ["data:image/png;base64,AA"] }, [])).not.toBe(base);
  });
});

describe("renderCard", () => {
  it("показывает путь блока и ожидающую правку модели", () => {
    const json = JSON.parse(renderCard(elena, [proposal("pending")]));
    expect(json.blocks[0]).toMatchObject({ block_id: "fears", path: "cards/1/fears.md", content: "Storms", pending_proposal: "Deep water" });
  });
});

describe("replayCardResults", () => {
  const cards = [elena, mira];

  it("прошлый ход: устаревший и вытесненный результат — заглушки, актуальный — как есть", () => {
    const history: StoredMessage[] = [
      { role: "user", content: "a" },
      ...read("g1", 1, renderCard(elena, [])),
      ...read("g2", 2, renderCard(mira, [])),
      ...read("g3", 2, renderCard(mira, [])),
      { role: "user", content: "b" },
    ];
    const replay = replayCardResults(history, cards, [proposal("rejected")]);
    expect(replay.get("g1")).toMatchObject({ kind: "stub", text: expect.stringContaining("Outdated") });
    expect(replay.get("g2")).toMatchObject({ kind: "stub", text: expect.stringContaining("Superseded") });
    expect(replay.get("g3")).toMatchObject({ kind: "current" });
    expect([...loadedCardIds(replay)]).toEqual([2]);
  });

  it("текущий ход не трогается: повторное чтение не вытесняет первое задним числом", () => {
    const history: StoredMessage[] = [
      { role: "user", content: "a" },
      ...read("g1", 1, renderCard(elena, [])),
      ...read("g2", 1, renderCard(elena, [])),
    ];
    const replay = replayCardResults(history, cards, []);
    expect(replay.get("g1")?.kind).toBe("current");
    expect(replay.get("g2")?.kind).toBe("current");
  });

  it("карточку убрали из чата — заглушка и не прочитана; ошибка вызова — как есть", () => {
    const history: StoredMessage[] = [
      { role: "user", content: "a" },
      ...read("g1", 1, renderCard(elena, [])),
      ...read("g2", 9, '{"error":"unknown card_id 9"}'),
    ];
    const replay = replayCardResults(history, [mira], []);
    expect(replay.get("g1")).toMatchObject({ kind: "stub", text: expect.stringContaining("no longer open") });
    expect(replay.has("g2")).toBe(false);
    expect(loadedCardIds(replay).size).toBe(0);
  });
});

describe("openTurnWithCardList", () => {
  it("после сообщения пользователя дописывает list_cards один раз", () => {
    const state = emptyCoauthorState();
    state.messages.push({ role: "user", content: "Hi" });
    openTurnWithCardList(state, [elena]);
    openTurnWithCardList(state, [elena]);
    expect(state.messages.map((m) => m.role)).toEqual(["user", "assistant", "tool"]);
    const list = JSON.parse((state.messages[2] as { content: string }).content);
    expect(list.cards[0]).toMatchObject({ card_id: 1, name: "Elena", blocks: [{ block_id: "fears", written: true }] });
    expect(list.cards[0]).not.toHaveProperty("read");
  });

  it("помечает карточки, актуальный результат get_card которых уже в разговоре", () => {
    const state = emptyCoauthorState();
    state.messages.push({ role: "user", content: "a" }, ...read("g1", 1, renderCard(elena, [])), { role: "user", content: "b" });
    openTurnWithCardList(state, [elena, mira]);
    const list = JSON.parse((state.messages.at(-1) as { content: string }).content);
    expect(list.cards.map((c: { read?: boolean }) => c.read ?? false)).toEqual([true, false]);
  });
});

describe("visibleHistory", () => {
  it("устаревший результат get_card при обрезке весит как заглушка — не вытесняет переписку", async () => {
    const { visibleHistory } = await import("./index.js");
    const big: CoauthorCardData = { ...elena, blocks: [{ id: "fears", title: "Fears", format: "", content: "storm and sea ".repeat(2000) }] };
    const history: StoredMessage[] = [
      { role: "user", content: "early question" },
      ...read("g1", 1, renderCard(big, [])),
      { role: "assistant", content: "Read." },
      { role: "user", content: "now" },
    ];
    // Решение пользователя по правке после чтения — карточка устарела, модели уйдёт заглушка.
    const visible = visibleHistory(history, [big], [proposal("rejected")], 1000);
    expect(visible.history[0]).toMatchObject({ role: "user", content: "early question" });
    expect(visible.cardResults.get("g1")?.kind).toBe("stub");
    // Актуальная карточка того же размера в бюджет не влезает — прошлый ход срезан, чтения в окне нет.
    const fresh = visibleHistory(history, [big], [], 1000);
    expect(fresh.history[0]).toMatchObject({ content: "now" });
    expect(fresh.cardResults.size).toBe(0);
  });
});
