import { HttpException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));
const engine = vi.hoisted(() => ({
  googleTranslate: vi.fn(),
  aiTranslate: vi.fn(),
}));
vi.mock("./engine/translators.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./engine/translators.js")>()),
  ...engine,
}));

const { TranslateService } = await import("./translate.service.js");
const { MissingApiKeyError } = await import("../llm/errors.js");
type Args = ConstructorParameters<typeof TranslateService>;

const LLM = { complete: vi.fn() };
const SETTINGS = { engine: "ai", targetLang: "en", promptTemplate: null, reasoningEffort: "off" };
function setup(settings: object = SETTINGS) {
  const repo = { get: vi.fn().mockResolvedValue(settings) };
  return { service: new TranslateService(repo as unknown as Args[0], LLM as unknown as Args[1]), repo };
}
const req = (mode: "google" | "ai", blocks = ["один", "два"]) => ({ blocks, sourceLang: "ru", targetLang: "en", mode });

async function httpError(promise: Promise<unknown>) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(HttpException);
  return { status: (err as HttpException).getStatus(), body: (err as HttpException).getResponse() };
}

describe("TranslateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    engine.googleTranslate.mockImplementation(async (text: string) => `g:${text}`);
    engine.aiTranslate.mockImplementation(async (_llm: unknown, _t: string, text: string) => `ai:${text}`);
  });

  it("google: переводы 1:1 по порядку блоков, настройки пользователя не читаются", async () => {
    const { service, repo } = setup();
    await expect(service.translateBlocks(1, req("google"))).resolves.toEqual(["g:один", "g:два"]);
    expect(engine.googleTranslate).toHaveBeenCalledWith("один", "en");
    expect(repo.get).not.toHaveBeenCalled();
  });

  it("ai: дефолтный шаблон при пустом, англ. название языка, effort off → без рассуждения; настройки — один раз", async () => {
    const { service, repo } = setup({ ...SETTINGS, promptTemplate: "   " });
    await expect(service.translateBlocks(7, req("ai"))).resolves.toEqual(["ai:один", "ai:два"]);
    expect(repo.get).toHaveBeenCalledTimes(1);
    expect(engine.aiTranslate).toHaveBeenCalledWith(LLM, expect.stringContaining("{{target_lang}}"), "один", "English", 7, false, undefined);
  });

  it("ai: свой шаблон и уровень рассуждения пользователя", async () => {
    const { service } = setup({ ...SETTINGS, promptTemplate: " Переведи на {{target_lang}} ", reasoningEffort: "high" });
    await service.translateBlocks(7, req("ai", ["x"]));
    expect(engine.aiTranslate).toHaveBeenCalledWith(LLM, "Переведи на {{target_lang}}", "x", "English", 7, true, "high");
  });

  it("нет ключа DeepSeek — 400 { error: no_api_key, message } без ретраев", async () => {
    engine.aiTranslate.mockRejectedValue(new MissingApiKeyError());
    const { status, body } = await httpError(setup().service.translateBlocks(1, req("ai", ["x"])));
    expect(status).toBe(400);
    expect(body).toEqual({ error: "no_api_key", message: expect.any(String) });
    expect(engine.aiTranslate).toHaveBeenCalledTimes(1);
  });

  it("прочий сбой переводчика — 500 Internal error", async () => {
    engine.googleTranslate.mockRejectedValue(new Error("Google Translate HTTP 429"));
    const { status } = await httpError(setup().service.translateBlocks(1, req("google")));
    expect(status).toBe(500);
  });
});
