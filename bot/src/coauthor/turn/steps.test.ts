import { describe, expect, it } from "vitest";
import { callStep, callSteps } from "./steps.js";

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

  it("list_cards и старый get_cards — сразу, get_card — когда читается card_id, ask_user — без шага", () => {
    expect(callStep({ id: "g", name: "get_cards", arguments: "" })).toMatchObject({ kind: "cards", status: "running" });
    expect(callStep({ id: "l", name: "list_cards", arguments: "" })).toMatchObject({ kind: "cards" });
    expect(callStep({ id: "c", name: "get_card", arguments: '{"card_id": 1' })).toBeUndefined();
    expect(callStep({ id: "c", name: "get_card", arguments: '{"card_id": 12}' }, "{}")).toEqual({ id: "c", status: "done", kind: "card", cardId: 12 });
    expect(callStep({ id: "a", name: "ask_user", arguments: "{}" })).toBeUndefined();
  });
});

describe("callSteps — apply_patch", () => {
  const patch = (args: string) => ({ id: "p1", name: "apply_patch", arguments: args });
  const two = "*** Begin Patch\n*** Update File: cards/3/look.md\n@@\n-a\n+b\n*** Update File: cards/4/look.md\n@@\n-c\n+d\n*** End Patch";

  it("по шагу на блок; пока стримится — только законченные строки путей", () => {
    expect(callSteps(patch("*** Begin Patch\n*** Update File: cards/3/look.md\n@@\n-a\n*** Update File: cards/4/lo"))).toEqual([
      { id: "p1:3:look", status: "running", kind: "edit", cardId: 3, blockId: "look" },
    ]);
    expect(callSteps(patch(two), '{"ok":true,"proposals":[]}').map((s) => [s.id, s.status])).toEqual([
      ["p1:3:look", "done"],
      ["p1:4:look", "done"],
    ]);
  });

  it("ошибка патча — все его шаги failed; чужие пути пропускаются", () => {
    expect(callSteps(patch(two), '{"error":"x"}').map((s) => s.status)).toEqual(["failed", "failed"]);
    expect(callSteps(patch("*** Begin Patch\n*** Update File: notes.txt\n-a\n+b"), '{"ok":true}')).toEqual([]);
  });

  it("остальные инструменты — как callStep", () => {
    expect(callSteps({ id: "g", name: "get_cards", arguments: "" })).toHaveLength(1);
    expect(callSteps({ id: "a", name: "ask_user", arguments: "{}" })).toEqual([]);
  });
});
