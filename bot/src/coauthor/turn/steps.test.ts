import { describe, expect, it } from "vitest";
import { callStep } from "./steps.js";

const edit = (args: string) => ({ id: "c1", name: "edit_block", arguments: args });

describe("callStep", () => {
  it("edit_block показывается, как только в неполных аргументах есть карточка и блок", () => {
    expect(callStep(edit('{"card_id": 12, "block_id": "fea'))).toBeUndefined();
    expect(callStep(edit('{"card_id": 12, "block_id": "fears", "content": "Sto'))).toEqual({
      id: "c1",
      status: "running",
      kind: "edit",
      cardId: 12,
      blockId: "fears",
    });
  });

  it("незавершённое число не принимается за id карточки", () => {
    expect(callStep(edit('{"block_id": "fears", "card_id": 1'))).toBeUndefined();
  });

  it("текст блока не путается с именами полей", () => {
    const args = JSON.stringify({ content: 'say "block_id": "fake", "card_id": 9,', card_id: 1, block_id: "real" });
    expect(callStep(edit(args))).toMatchObject({ cardId: 1, blockId: "real" });
  });

  it("статус — из результата инструмента", () => {
    const args = '{"card_id":1,"block_id":"fears"}';
    expect(callStep(edit(args), '{"ok":true,"proposal_id":"p1"}')?.status).toBe("done");
    expect(callStep(edit(args), '{"error":"unknown card_id"}')?.status).toBe("failed");
  });

  it("web_search — запрос, только когда строка дошла целиком и с экранированием", () => {
    expect(callStep({ id: "s", name: "web_search", arguments: '{"query": "Elena' })).toBeUndefined();
    expect(callStep({ id: "s", name: "web_search", arguments: '{"query": "Elena \\"Voss\\""}' })).toMatchObject({
      kind: "search",
      query: 'Elena "Voss"',
    });
  });

  it("get_cards — сразу, ask_user — без шага", () => {
    expect(callStep({ id: "g", name: "get_cards", arguments: "" })).toMatchObject({ kind: "cards", status: "running" });
    expect(callStep({ id: "a", name: "ask_user", arguments: "{}" })).toBeUndefined();
  });
});
