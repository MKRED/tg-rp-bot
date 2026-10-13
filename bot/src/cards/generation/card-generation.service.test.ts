import { HttpException } from "@nestjs/common";
import type { CardCategory } from "@tg-rp-bot/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));
const runCardGenerationToolLoop = vi.fn();
const LLM = { complete: vi.fn() };
const tavily = { search: vi.fn().mockResolvedValue([]) };
vi.mock("./tool-loop.js", () => ({ runCardGenerationToolLoop }));
vi.mock("../../prompt/promptBuilder/index.js", () => ({ presetToCompletionOptions: () => ({ temperature: 0.5 }) }));

const { CardGenerationService } = await import("./card-generation.service.js");
const { tryLockCard, unlockCard } = await import("../card-lock.js");
const { MissingApiKeyError } = await import("../../llm/errors.js");
const { ASK_USER_DECLINED_ANSWER, ASK_USER_MAX_ANSWERED_QUESTIONS } = await import("./ask-user-tool.js");
type Cards = ConstructorParameters<typeof CardGenerationService>[0];
type Presets = ConstructorParameters<typeof CardGenerationService>[1];
type TavilySettings = ConstructorParameters<typeof CardGenerationService>[2];

const CARD_ID = 5;
const category = (id: string, over: Partial<CardCategory> = {}): CardCategory => ({
  id,
  title: id,
  description: "d",
  content: "",
  enabled: true,
  ...over,
});
const makeCard = (over: Record<string, unknown> = {}) => ({
  id: CARD_ID,
  systemPrompt: "sys",
  prompt: "p",
  categories: [category("a"), category("b")],
  presetId: 3,
  useWebSearch: false,
  useAskUser: false,
  askUserFirst: false,
  ...over,
});

/** Явный undefined в opts — «нет такой записи» (не подмена дефолтом, как у параметра по умолчанию). */
function setup(opts: { card?: ReturnType<typeof makeCard>; preset?: object } = {}) {
  const card = "card" in opts ? opts.card : makeCard();
  const preset = "preset" in opts ? opts.preset : { id: 3 };
  const cards = {
    findOne: vi.fn().mockResolvedValue(card),
    clearCategoryToolContext: vi.fn().mockResolvedValue(card),
    setCategoryContent: vi.fn().mockResolvedValue(card),
    appendCategoryWebSearches: vi.fn().mockResolvedValue(card),
    setCategoryPendingQuestions: vi.fn().mockResolvedValue(card),
    applyCategoryAnswers: vi.fn().mockResolvedValue(card),
  };
  const presets = { findOne: vi.fn().mockResolvedValue(preset) };
  const tavilySettings = { getDecryptedKey: vi.fn().mockResolvedValue(null), getMaxSearchRounds: vi.fn().mockResolvedValue(3) };
  const service = new CardGenerationService(
    cards as unknown as Cards,
    presets as unknown as Presets,
    tavilySettings as unknown as TavilySettings,
    LLM as unknown as ConstructorParameters<typeof CardGenerationService>[3],
    tavily as unknown as ConstructorParameters<typeof CardGenerationService>[4],
  );
  return { service, cards, tavilySettings };
}

/** Отказ генерации → { status, error }, как его отдал бы ApiExceptionFilter. */
async function refusal(promise: Promise<unknown>) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpException);
  return { status: (err as HttpException).getStatus(), body: (err as HttpException).getResponse() };
}

/** Лок карточки свободен (после проверки снова освобождается). */
function lockFree(): boolean {
  const free = tryLockCard(CARD_ID);
  if (free) unlockCard(CARD_ID);
  return free;
}

describe("CardGenerationService.generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unlockCard(CARD_ID);
  });

  it("следующий незаполненный блок: генерирует, сохраняет обрезанный текст, снимает лок", async () => {
    runCardGenerationToolLoop.mockResolvedValue({ done: true, content: "  text  " });
    const { service, cards } = setup();
    await expect(service.generate(1, CARD_ID)).resolves.toEqual({
      status: "done",
      categoryId: "a",
      content: "text",
      toolContextTokens: 0,
    });
    expect(cards.setCategoryContent).toHaveBeenCalledWith(1, CARD_ID, "a", "text", []);
    expect(runCardGenerationToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({ llm: LLM, webSearch: null, maxSearchRounds: 3, askUserEnabled: false }),
    );
    expect(lockFree()).toBe(true);
  });

  it("карточка занята — 409 busy, чужой лок не снимается", async () => {
    const { service } = setup();
    tryLockCard(CARD_ID);
    expect(await refusal(service.generate(1, CARD_ID))).toEqual({ status: 409, body: "busy" });
    expect(lockFree()).toBe(false);
  });

  it.each([
    { title: "карточки нет", card: undefined, preset: { id: 3 }, expected: { status: 404, body: "not_found" } },
    { title: "пресет не выбран", card: makeCard({ presetId: null }), preset: { id: 3 }, expected: { status: 400, body: "preset_required" } },
    { title: "пресет не найден", card: makeCard(), preset: undefined, expected: { status: 400, body: "preset_required" } },
    {
      title: "всё заполнено",
      card: makeCard({ categories: [category("a", { content: "x" })] }),
      preset: { id: 3 },
      expected: { status: 409, body: "nothing_to_generate" },
    },
  ])("отказ до LLM: $title — лок снят", async ({ card, preset, expected }) => {
    const { service } = setup({ card, preset });
    expect(await refusal(service.generate(1, CARD_ID))).toEqual(expected);
    expect(runCardGenerationToolLoop).not.toHaveBeenCalled();
    expect(lockFree()).toBe(true);
  });

  it("явный блок, которого нет, — 400 target_not_found", async () => {
    const { service } = setup();
    expect(await refusal(service.generate(1, CARD_ID, "zzz", true))).toEqual({ status: 400, body: "target_not_found" });
  });

  describe("веб-поиски генерации сохраняются на категории", () => {
    const record = { query: "q", results: [{ title: "T", url: "u", content: "c" }] };
    /** Цикл, который «выполнил» один поиск (отдал его в onWebSearch) и закончился как задано. */
    const loopWithSearch = (end: () => unknown) =>
      runCardGenerationToolLoop.mockImplementation(async (params: { onWebSearch: (r: typeof record) => void }) => {
        params.onWebSearch(record);
        return end();
      });

    it("готовый блок — поиски уходят той же записью, что и текст; в ответе вес контекста", async () => {
      loopWithSearch(() => ({ done: true, content: "t" }));
      const saved = makeCard({ categories: [category("a", { content: "t", webSearches: [record] })] });
      const { service, cards } = setup();
      cards.setCategoryContent.mockResolvedValue(saved);
      const step = await service.generate(1, CARD_ID);
      expect(cards.setCategoryContent).toHaveBeenCalledWith(1, CARD_ID, "a", "t", [record]);
      expect(step.toolContextTokens).toBeGreaterThan(0);
      expect(cards.appendCategoryWebSearches).not.toHaveBeenCalled();
    });

    it("пауза ask_user — поиски сохраняются вместе с вопросами", async () => {
      const questions = [{ question: "Q?" }];
      loopWithSearch(() => ({ done: false, questions }));
      const { service, cards } = setup({ card: makeCard({ useAskUser: true }) });
      await service.generate(1, CARD_ID);
      expect(cards.setCategoryPendingQuestions).toHaveBeenCalledWith(1, CARD_ID, "a", questions, [record]);
    });

    it("сбой LLM после поиска — поиски всё равно сохраняются, наверх уходит исходная ошибка", async () => {
      loopWithSearch(() => {
        throw new Error("llm down");
      });
      const { service, cards } = setup();
      await expect(service.generate(1, CARD_ID)).rejects.toThrow("llm down");
      expect(cards.appendCategoryWebSearches).toHaveBeenCalledWith(1, CARD_ID, "a", [record]);
      expect(lockFree()).toBe(true);
    });

    it("лимит поисков сквозной для блока: сохранённые поиски вычитаются", async () => {
      runCardGenerationToolLoop.mockResolvedValue({ done: true, content: "t" });
      const { service } = setup({ card: makeCard({ categories: [category("a", { webSearches: [record, record] })] }) });
      await service.generate(1, CARD_ID);
      expect(runCardGenerationToolLoop).toHaveBeenCalledWith(expect.objectContaining({ maxSearchRounds: 1 }));
    });
  });

  it("«Перегенерировать» сбрасывает и сохранённые веб-поиски блока", async () => {
    runCardGenerationToolLoop.mockResolvedValue({ done: true, content: "t" });
    const webSearches = [{ query: "q", results: [] }];
    const { service, cards } = setup({ card: makeCard({ categories: [category("a", { content: "x", webSearches })] }) });
    await service.generate(1, CARD_ID, "a", true);
    expect(cards.clearCategoryToolContext).toHaveBeenCalledWith(1, CARD_ID, "a");
  });

  it("«Перегенерировать» сбрасывает накопленные ответы ask_user целевого блока, резюме — нет", async () => {
    runCardGenerationToolLoop.mockResolvedValue({ done: true, content: "t" });
    const card = makeCard({
      categories: [category("a", { content: "x", askUserAnswers: [{ question: "Q", answer: "A" }] })],
    });
    const { service, cards } = setup({ card });
    await service.generate(1, CARD_ID, "a", true);
    expect(cards.clearCategoryToolContext).toHaveBeenCalledWith(1, CARD_ID, "a");
    cards.clearCategoryToolContext.mockClear();
    await service.generate(1, CARD_ID, "a", false);
    expect(cards.clearCategoryToolContext).not.toHaveBeenCalled();
  });

  it("пауза на ask_user: вопросы сохраняются на категории, лок снят", async () => {
    const questions = [{ question: "Q?", options: ["x"] }];
    runCardGenerationToolLoop.mockResolvedValue({ done: false, questions });
    const { service, cards } = setup({ card: makeCard({ useAskUser: true }) });
    await expect(service.generate(1, CARD_ID)).resolves.toEqual({
      status: "questions",
      categoryId: "a",
      questions,
      toolContextTokens: 0,
    });
    expect(cards.setCategoryPendingQuestions).toHaveBeenCalledWith(1, CARD_ID, "a", questions, []);
    expect(cards.setCategoryContent).not.toHaveBeenCalled();
    expect(lockFree()).toBe(true);
  });

  it("ask_user выключается, когда у блока исчерпан бюджет ответов", async () => {
    runCardGenerationToolLoop.mockResolvedValue({ done: true, content: "t" });
    const answers = Array.from({ length: ASK_USER_MAX_ANSWERED_QUESTIONS }, () => ({ question: "Q", answer: "A" }));
    const { service } = setup({ card: makeCard({ useAskUser: true, categories: [category("a", { askUserAnswers: answers })] }) });
    await service.generate(1, CARD_ID);
    expect(runCardGenerationToolLoop).toHaveBeenCalledWith(expect.objectContaining({ askUserEnabled: false }));
  });

  it("дополнения пользователя бюджет вопросов блока не расходуют", async () => {
    runCardGenerationToolLoop.mockResolvedValue({ done: true, content: "t" });
    const answers = [
      ...Array.from({ length: ASK_USER_MAX_ANSWERED_QUESTIONS - 1 }, () => ({ question: "Q", answer: "A" })),
      { question: "", answer: "note", unprompted: true as const },
    ];
    const { service } = setup({ card: makeCard({ useAskUser: true, categories: [category("a", { askUserAnswers: answers })] }) });
    await service.generate(1, CARD_ID);
    expect(runCardGenerationToolLoop).toHaveBeenCalledWith(expect.objectContaining({ askUserEnabled: true }));
  });

  it("forceAskUser уходит в цикл, но выключенный тумблер уточнений карточки не обходит", async () => {
    runCardGenerationToolLoop.mockResolvedValue({ done: true, content: "t" });
    const on = setup({ card: makeCard({ useAskUser: true }) });
    await on.service.generate(1, CARD_ID, undefined, false, true);
    expect(runCardGenerationToolLoop).toHaveBeenLastCalledWith(
      expect.objectContaining({ askUserEnabled: true, forceAskUser: "last" }),
    );
    // Режим — из настройки сохранённой карточки.
    const first = setup({ card: makeCard({ useAskUser: true, askUserFirst: true }) });
    await first.service.generate(1, CARD_ID, undefined, false, true);
    expect(runCardGenerationToolLoop).toHaveBeenLastCalledWith(expect.objectContaining({ forceAskUser: "first" }));

    const off = setup();
    await off.service.generate(1, CARD_ID, undefined, false, true);
    expect(runCardGenerationToolLoop).toHaveBeenLastCalledWith(expect.objectContaining({ askUserEnabled: false }));
  });

  it("веб-поиск: поиск идёт через TavilyService с ключом пользователя; без ключа — генерация без поиска", async () => {
    runCardGenerationToolLoop.mockResolvedValue({ done: true, content: "t" });
    const { service, tavilySettings } = setup({ card: makeCard({ useWebSearch: true }) });
    tavilySettings.getDecryptedKey.mockResolvedValueOnce("tvly-key").mockResolvedValueOnce(null);
    await service.generate(1, CARD_ID);
    const { webSearch } = runCardGenerationToolLoop.mock.lastCall![0];
    await webSearch.search("кто такой X");
    expect(tavily.search).toHaveBeenCalledWith("tvly-key", "кто такой X");
    await service.generate(1, CARD_ID);
    expect(runCardGenerationToolLoop).toHaveBeenLastCalledWith(expect.objectContaining({ webSearch: null }));
  });

  it("нет ключа DeepSeek — 400 { error: no_api_key, message }, лок снят", async () => {
    runCardGenerationToolLoop.mockRejectedValue(new MissingApiKeyError());
    const { service } = setup();
    const { status, body } = await refusal(service.generate(1, CARD_ID));
    expect(status).toBe(400);
    expect(body).toEqual({ error: "no_api_key", message: expect.any(String) });
    expect(lockFree()).toBe(true);
  });

  it("прочие ошибки пробрасываются как есть, лок снят", async () => {
    runCardGenerationToolLoop.mockRejectedValue(new Error("boom"));
    const { service } = setup();
    await expect(service.generate(1, CARD_ID)).rejects.toThrow("boom");
    expect(lockFree()).toBe(true);
  });
});

describe("CardGenerationService.answer", () => {
  const pendingCard = () =>
    makeCard({
      categories: [category("a", { pendingQuestions: [{ question: "Q1", options: ["o"] }, { question: "Q2" }] })],
    });

  beforeEach(() => {
    vi.clearAllMocks();
    unlockCard(CARD_ID);
    runCardGenerationToolLoop.mockResolvedValue({ done: true, content: "t" });
  });

  it("ответы записываются по порядку вопросов (с options), затем блок генерируется заново", async () => {
    const { service, cards } = setup({ card: pendingCard() });
    await expect(service.answer(1, CARD_ID, "a", { skipped: false, answers: ["A1", "A2"] })).resolves.toMatchObject({
      status: "done",
    });
    expect(cards.applyCategoryAnswers).toHaveBeenCalledWith(1, CARD_ID, "a", [
      { question: "Q1", answer: "A1", options: ["o"] },
      { question: "Q2", answer: "A2", options: undefined },
    ]);
    // Резюме паузы — не «Перегенерировать»: накопленные ответы не сбрасываются.
    expect(cards.clearCategoryToolContext).not.toHaveBeenCalled();
    // И не принуждает к вопросам снова, даже если пауза началась с кнопки «с вопросами».
    expect(runCardGenerationToolLoop).toHaveBeenCalledWith(expect.objectContaining({ forceAskUser: undefined }));
    expect(lockFree()).toBe(true);
  });

  it("отказ отвечать — на каждый вопрос записывается маркер отказа", async () => {
    const { service, cards } = setup({ card: pendingCard() });
    await service.answer(1, CARD_ID, "a", { skipped: true });
    const written = cards.applyCategoryAnswers.mock.calls[0]![3] as { answer: string }[];
    expect(written.map((a) => a.answer)).toEqual([ASK_USER_DECLINED_ANSWER, ASK_USER_DECLINED_ANSWER]);
  });

  it("пустой ответ — вопрос без ответа, пишется маркер отказа, а не пустая строка", async () => {
    const { service, cards } = setup({ card: pendingCard() });
    await service.answer(1, CARD_ID, "a", { skipped: false, answers: ["  ", " A2 "] });
    const written = cards.applyCategoryAnswers.mock.calls[0]![3] as { answer: string }[];
    expect(written.map((a) => a.answer)).toEqual([ASK_USER_DECLINED_ANSWER, "A2"]);
  });

  it("дополнение пользователя пишется отдельной unprompted-записью после ответов", async () => {
    const { service, cards } = setup({ card: pendingCard() });
    await service.answer(1, CARD_ID, "a", { skipped: false, answers: ["A1", "A2"], note: " Ещё она левша " });
    const written = cards.applyCategoryAnswers.mock.calls[0]![3] as unknown[];
    expect(written).toHaveLength(3);
    expect(written[2]).toEqual({ question: "", answer: "Ещё она левша", unprompted: true });
  });

  it("дополнение не теряется при отказе отвечать; пустое — не пишется", async () => {
    const { service, cards } = setup({ card: pendingCard() });
    await service.answer(1, CARD_ID, "a", { skipped: true, note: "Только это" });
    const written = cards.applyCategoryAnswers.mock.calls[0]![3] as { answer: string }[];
    expect(written.map((a) => a.answer)).toEqual([ASK_USER_DECLINED_ANSWER, ASK_USER_DECLINED_ANSWER, "Только это"]);

    const second = setup({ card: pendingCard() });
    await second.service.answer(1, CARD_ID, "a", { skipped: true, note: "  " });
    expect(second.cards.applyCategoryAnswers.mock.calls[0]![3]).toHaveLength(2);
  });

  it("нет ожидающих вопросов — 404 no_pending_question, без записи", async () => {
    const { service, cards } = setup();
    expect(await refusal(service.answer(1, CARD_ID, "a", { skipped: true }))).toEqual({ status: 404, body: "no_pending_question" });
    expect(cards.applyCategoryAnswers).not.toHaveBeenCalled();
    expect(lockFree()).toBe(true);
  });

  it("число ответов не совпадает — 400 answers_mismatch", async () => {
    const { service } = setup({ card: pendingCard() });
    expect(await refusal(service.answer(1, CARD_ID, "a", { skipped: false, answers: ["A1"] }))).toEqual({
      status: 400,
      body: "answers_mismatch",
    });
    expect(runCardGenerationToolLoop).not.toHaveBeenCalled();
  });

  it("карточка занята — 409 busy", async () => {
    const { service } = setup({ card: pendingCard() });
    tryLockCard(CARD_ID);
    expect(await refusal(service.answer(1, CARD_ID, "a", { skipped: true }))).toEqual({ status: 409, body: "busy" });
    unlockCard(CARD_ID);
  });
});
