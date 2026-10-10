import { HttpException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));
const engine = vi.hoisted(() => ({
  aiTranslate: vi.fn(),
  googleTranslate: vi.fn(),
  englishLangName: (code: string) => `lang:${code}`,
}));
const LLM = { complete: vi.fn() };
vi.mock("../../translate/engine/index.js", () => engine);

const { MissingApiKeyError } = await import("../../llm/errors.js");
const { ChatTranslationService } = await import("./chat-translation.service.js");
type Args = ConstructorParameters<typeof ChatTranslationService>;

const CHAT = { id: 5, activeMessageId: 1, templateId: 3, presetId: 4 };

function setup(method: "google" | "ai" = "google", translations: Record<string, string> | null = null) {
  const access = {
    requireRow: vi.fn().mockResolvedValue(CHAT),
    requireMessage: vi.fn().mockResolvedValue({ chat: CHAT, msg: { id: 9, chatId: 5, content: "Текст", translations } }),
  };
  const messages = {
    saveTranslation: vi.fn(),
    deleteTranslation: vi.fn(),
  };
  const settings = { get: vi.fn().mockResolvedValue({ translateMethod: method }) };
  const templates = { findOne: vi.fn().mockResolvedValue({ translationSystemPrompt: "PROMPT" }) };
  const presets = { findOne: vi.fn().mockResolvedValue({ reasoningEffort: "high" }) };
  const service = new ChatTranslationService(
    access as unknown as Args[0],
    messages as unknown as Args[1],
    settings as unknown as Args[2],
    templates as unknown as Args[3],
    presets as unknown as Args[4],
    LLM as unknown as Args[5],
  );
  return { service, access, messages, templates, presets };
}

async function httpError(promise: Promise<unknown>) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(HttpException);
  return { status: (err as HttpException).getStatus(), body: (err as HttpException).getResponse() };
}

describe("ChatTranslationService.translateMessage", () => {
  beforeEach(() => {
    engine.aiTranslate.mockReset().mockResolvedValue("AI");
    engine.googleTranslate.mockReset().mockResolvedValue("GOOGLE");
  });

  it("кэш есть и не force — без перевода и записи; force — пересчёт и перезапись", async () => {
    const { service, messages } = setup("google", { en: "cached" });
    await expect(service.translateMessage(1, 5, 9, { targetLang: "en", force: false })).resolves.toBe("cached");
    expect(engine.googleTranslate).not.toHaveBeenCalled();
    await expect(service.translateMessage(1, 5, 9, { targetLang: "en", force: true })).resolves.toBe("GOOGLE");
    expect(messages.saveTranslation).toHaveBeenCalledWith(1, 9, "en", "GOOGLE");
  });

  it("метод ai — промпт перевода из RP-шаблона, эффорт из пресета", async () => {
    const { service } = setup("ai");
    await expect(service.translateMessage(1, 5, 9, { targetLang: "en" })).resolves.toBe("AI");
    expect(engine.aiTranslate).toHaveBeenCalledWith(LLM, "PROMPT", "Текст", "lang:en", 1, true, "high");
  });

  it("нет ключа DeepSeek — 400 no_api_key с подсказкой; прочий сбой — 500", async () => {
    const { service } = setup("ai");
    engine.aiTranslate.mockRejectedValueOnce(new MissingApiKeyError());
    expect(await httpError(service.translateMessage(1, 5, 9, { targetLang: "en" }))).toEqual({
      status: 400,
      body: { error: "no_api_key", message: new MissingApiKeyError().message },
    });
    engine.aiTranslate.mockRejectedValueOnce(new Error("boom"));
    expect((await httpError(service.translateMessage(1, 5, 9, { targetLang: "en" }))).status).toBe(500);
  });
});

describe("ChatTranslationService.translateText", () => {
  beforeEach(() => {
    engine.aiTranslate.mockReset().mockResolvedValue("AI");
    engine.googleTranslate.mockReset().mockResolvedValue("GOOGLE");
  });

  it("google — без шаблона и пресета; ai — с ними; чат проверяется в обоих", async () => {
    const { service, access, templates } = setup();
    await expect(service.translateText(1, 5, { text: "a", targetLang: "en", mode: "google" })).resolves.toBe("GOOGLE");
    expect(templates.findOne).not.toHaveBeenCalled();
    await expect(service.translateText(1, 5, { text: "a", targetLang: "en", mode: "ai" })).resolves.toBe("AI");
    expect(templates.findOne).toHaveBeenCalledWith(1, 3);
    expect(access.requireRow).toHaveBeenCalledTimes(2);
  });

  it("сбой Google — 500 Internal error", async () => {
    const { service } = setup();
    engine.googleTranslate.mockRejectedValueOnce(new Error("Google Translate HTTP 429"));
    expect((await httpError(service.translateText(1, 5, { text: "a", targetLang: "en", mode: "google" }))).status).toBe(500);
  });

  it("ai без ключа — 400 no_api_key", async () => {
    const { service } = setup();
    engine.aiTranslate.mockRejectedValueOnce(new MissingApiKeyError());
    expect((await httpError(service.translateText(1, 5, { text: "a", targetLang: "en", mode: "ai" }))).status).toBe(400);
  });
});
