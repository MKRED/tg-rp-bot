import { HttpException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));
const googleTranslate = vi.hoisted(() => vi.fn());
vi.mock("../../translate/engine/index.js", async (importOriginal) => ({ ...(await importOriginal<object>()), googleTranslate }));
const aiTranslateStoryText = vi.hoisted(() => vi.fn());
const LLM = { complete: vi.fn() };
vi.mock("./ai-translate-story-text.js", () => ({ aiTranslateStoryText }));

const { MissingApiKeyError } = await import("../../llm/errors.js");
const { StoryTranslationService } = await import("./story-translation.service.js");
type A = ConstructorParameters<typeof StoryTranslationService>;

const STORY = { id: 5, templateId: 2 };

function setup(translations: Record<string, string> | null = null, translateMethod = "google") {
  const access = {
    requireMessage: vi.fn().mockResolvedValue({ story: STORY, msg: { id: 9, content: "Бит", translations } }),
    requireRow: vi.fn().mockResolvedValue(STORY),
  };
  const messages = { saveTranslation: vi.fn(), deleteTranslation: vi.fn() };
  const settings = { get: vi.fn().mockResolvedValue({ translateMethod }) };
  const templates = { findOne: vi.fn().mockResolvedValue({ translationReasoningEffort: "off" }) };
  const service = new StoryTranslationService(
    access as unknown as A[0],
    messages as unknown as A[1],
    settings as unknown as A[2],
    templates as unknown as A[3],
    LLM as unknown as A[4],
  );
  return { service, messages, templates };
}

describe("StoryTranslationService", () => {
  beforeEach(() => {
    googleTranslate.mockReset().mockResolvedValue("Beat");
    aiTranslateStoryText.mockReset().mockResolvedValue("AI beat");
  });

  it("кэш есть и не force — без переводчика", async () => {
    const { service, messages } = setup({ en: "cached" });
    expect(await service.translateMessage(1, 5, 9, { targetLang: "en" })).toBe("cached");
    expect(googleTranslate).not.toHaveBeenCalled();
    expect(messages.saveTranslation).not.toHaveBeenCalled();
  });

  it("force — переводим методом из настроек и перезаписываем кэш", async () => {
    const { service, messages } = setup({ en: "cached" }, "ai");
    expect(await service.translateMessage(1, 5, 9, { targetLang: "en", force: true })).toBe("AI beat");
    expect(messages.saveTranslation).toHaveBeenCalledWith(1, 9, "en", "AI beat");
    expect(aiTranslateStoryText.mock.lastCall![0]).toBe(LLM);
  });

  it("черновик без mode — Google, шаблон не читаем", async () => {
    const { service, templates } = setup();
    expect(await service.translateText(1, 5, { text: "Привет", targetLang: "en" })).toBe("Beat");
    expect(templates.findOne).not.toHaveBeenCalled();
  });

  it("нет ключа DeepSeek — 400 no_api_key с подсказкой", async () => {
    const { service } = setup();
    aiTranslateStoryText.mockRejectedValueOnce(new MissingApiKeyError());
    const err = (await service.translateText(1, 5, { text: "x", targetLang: "en", mode: "ai" }).catch((e: unknown) => e)) as HttpException;
    expect(err.getStatus()).toBe(400);
    expect(err.getResponse()).toMatchObject({ error: "no_api_key" });
  });
});
