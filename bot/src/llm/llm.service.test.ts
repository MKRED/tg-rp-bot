import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../settings/llm/llm-settings.repository.js", () => ({ LlmSettingsRepository: class {} }));
const requestChatCompletion = vi.hoisted(() => vi.fn());
vi.mock("./client.js", () => ({ requestChatCompletion }));

const { LlmService } = await import("./llm.service.js");
const { MissingApiKeyError } = await import("./errors.js");
const { DEFAULT_DEEPSEEK_MODEL } = await import("./constants.js");
type Repo = ConstructorParameters<typeof LlmService>[0];

const OPTIONS = { messages: [], userId: 7 };

function setup(apiKey: string | null) {
  const settings = { getDecryptedApiKey: vi.fn().mockResolvedValue(apiKey) };
  return { settings, service: new LlmService(settings as unknown as Repo) };
}

describe("LlmService.complete", () => {
  beforeEach(() => requestChatCompletion.mockReset().mockResolvedValue({ content: "ok" }));

  it("ключа нет — MissingApiKeyError, запрос к провайдеру не уходит", async () => {
    const { service } = setup(null);
    await expect(service.complete(OPTIONS)).rejects.toBeInstanceOf(MissingApiKeyError);
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });

  it("ключ пользователя → провайдер DeepSeek; опции и callback'и стрима проброшены как есть", async () => {
    const { service, settings } = setup("sk-user");
    const onChunk = vi.fn();
    const onReset = vi.fn();
    const options = { ...OPTIONS, model: "deepseek-v4-pro" };
    await expect(service.complete(options, onChunk, onReset)).resolves.toEqual({ content: "ok" });
    expect(settings.getDecryptedApiKey).toHaveBeenCalledWith(7);
    const [provider, passed, chunk, reset] = requestChatCompletion.mock.lastCall!;
    expect(provider).toMatchObject({ name: "deepseek", apiKey: "sk-user" });
    expect([passed, chunk, reset]).toEqual([options, onChunk, onReset]);
  });

  it("модель провайдера по умолчанию — для вызовов без модели пресета", async () => {
    const { service } = setup("sk-user");
    await service.complete(OPTIONS);
    expect(requestChatCompletion.mock.lastCall![0].defaultModel).toBe(DEFAULT_DEEPSEEK_MODEL);
  });

  it("ключ читается на каждый вызов — смена ключа в настройках действует сразу", async () => {
    const { service, settings } = setup("sk-1");
    await service.complete(OPTIONS);
    settings.getDecryptedApiKey.mockResolvedValue("sk-2");
    await service.complete(OPTIONS);
    expect(requestChatCompletion.mock.calls.map((c) => c[0].apiKey)).toEqual(["sk-1", "sk-2"]);
  });
});
