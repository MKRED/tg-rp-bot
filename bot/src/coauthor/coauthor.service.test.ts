import { describe, expect, it, vi } from "vitest";
import type { CoauthorProposal } from "@tg-rp-bot/shared";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
// Репозитории подменяются целиком; модуль БД (и config.ts с обязательным .env) не грузим.
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));

const { CoauthorService } = await import("./coauthor.service.js");
const { tryLockCard, unlockCard } = await import("../cards/card-lock.js");
const { emptyCoauthorState } = await import("./turn/state.js");
type Repo = ConstructorParameters<typeof CoauthorService>[0];
type Cards = ConstructorParameters<typeof CoauthorService>[1];
type Presets = ConstructorParameters<typeof CoauthorService>[2];

const card = (id: number, content: string) => ({
  id,
  name: `Card ${id}`,
  prompt: "",
  referenceImages: [],
  categories: [{ id: "rel", title: "Relationships", description: "", content, enabled: true }],
});

const proposal = (id: string, cardId: number, baseContent: string): CoauthorProposal => ({
  id,
  cardId,
  blockId: "rel",
  content: `new ${id}`,
  baseContent,
  status: "pending",
});

/** Сервис с чатом над карточками 1 и 2 и заданными правками; cards — текущее содержимое блоков. */
function setup(proposals: CoauthorProposal[], contents: Record<number, string>) {
  const state = { ...emptyCoauthorState(), proposals };
  const chat = { id: 7, name: "Chat", cardIds: [1, 2], presetId: null, systemPrompt: "", useWebSearch: false, useImages: true, state };
  const repo = {
    findOne: vi.fn().mockResolvedValue(chat),
    saveState: vi.fn().mockImplementation(async (_u, _id, saved) => ({ ...chat, state: saved })),
  };
  const cards = {
    findMany: vi.fn().mockImplementation(async () => [card(1, contents[1]!), card(2, contents[2]!)]),
    findOne: vi.fn().mockImplementation(async (_u: string, id: number) => card(id, contents[id]!)),
    setCategoryContent: vi.fn().mockResolvedValue({}),
  };
  const service = new CoauthorService(repo as unknown as Repo, cards as unknown as Cards, {} as Presets);
  return { service, repo, cards };
}

describe("CoauthorService.review", () => {
  it("принятие пишет блок в карточку, решение уходит в reviewNotes, ответ без running", async () => {
    const { service, cards, repo } = setup([proposal("p1", 1, "old")], { 1: "old", 2: "x" });
    const result = await service.review("u", 7, { proposalIds: ["p1"], accept: true });
    expect(cards.setCategoryContent).toHaveBeenCalledWith("u", 1, "rel", "new p1");
    const saved = repo.saveState.mock.calls[0]![2];
    expect(saved.proposals[0].status).toBe("accepted");
    expect(saved.reviewNotes).toEqual(["accepted Card 1 → Relationships"]);
    expect(result.chat.running).toBe(false);
  });

  it("блок изменили после предложения — правка остаётся ожидающей и возвращается в stale", async () => {
    const { service, cards } = setup([proposal("p1", 1, "old")], { 1: "edited by hand", 2: "x" });
    const result = await service.review("u", 7, { proposalIds: ["p1"], accept: true });
    expect(result.stale).toEqual(["p1"]);
    expect(cards.setCategoryContent).not.toHaveBeenCalled();
    expect(result.chat.proposals[0]!.status).toBe("pending");
  });

  it("занятая карточка пропускается, а уже принятые правки сохраняются", async () => {
    const { service, repo } = setup([proposal("p1", 1, "a"), proposal("p2", 2, "b")], { 1: "a", 2: "b" });
    expect(tryLockCard(2)).toBe(true);
    try {
      const result = await service.review("u", 7, { proposalIds: ["p1", "p2"], accept: true });
      expect(result.busy).toEqual(["p2"]);
      const saved = repo.saveState.mock.calls[0]![2];
      expect(saved.proposals.map((p: CoauthorProposal) => p.status)).toEqual(["accepted", "pending"]);
    } finally {
      unlockCard(2);
    }
  });

  it("отклонение не трогает карточку", async () => {
    const { service, cards } = setup([proposal("p1", 1, "old")], { 1: "old", 2: "x" });
    const result = await service.review("u", 7, { proposalIds: ["p1"], accept: false });
    expect(cards.setCategoryContent).not.toHaveBeenCalled();
    expect(result.chat.proposals[0]!.status).toBe("rejected");
  });
});
