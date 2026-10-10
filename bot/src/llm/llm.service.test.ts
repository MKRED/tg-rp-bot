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

function setup(creds: { apiKey: string; model: string | null } | null) {
  const settings = { getDecryptedCredentials: vi.fn().mockResolvedValue(creds) };
  return { settings, service: new LlmService(settings as unknown as Repo) };
}

describe("LlmService.complete", () => {
  beforeEach(() => requestChatCompletion.mockReset().mockResolvedValue({ content: "ok" }));

  it("ключа нет — MissingApiKeyError, запрос к провайдеру не уходит", async () => {
    const { service } = setup(null);
    await expect(service.complete(OPTIONS)).rejects.toBeInstanceOf(MissingApiKeyError);
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });

  it("ключ и модель пользователя → провайдер DeepSeek; callback'и стрима проброшены как есть", async () => {
    const { service, settings } = setup({ apiKey: "sk-user", model: "deepseek-pro" });
    const onChunk = vi.fn();
    const onReset = vi.fn();
    await expect(service.complete(OPTIONS, onChunk, onReset)).resolves.toEqual({ content: "ok" });
    expect(settings.getDecryptedCredentials).toHaveBeenCalledWith(7);
    const [provider, options, chunk, reset] = requestChatCompletion.mock.lastCall!;
    expect(provider).toMatchObject({ name: "deepseek", apiKey: "sk-user", defaultModel: "deepseek-pro" });
    expect([options, chunk, reset]).toEqual([OPTIONS, onChunk, onReset]);
  });

  it("модель не выбрана — модель по умолчанию", async () => {
    const { service } = setup({ apiKey: "sk-user", model: null });
    await service.complete(OPTIONS);
    expect(requestChatCompletion.mock.lastCall![0].defaultModel).toBe(DEFAULT_DEEPSEEK_MODEL);
  });

  it("ключ читается на каждый вызов — смена ключа в настройках действует сразу", async () => {
    const { service, settings } = setup({ apiKey: "sk-1", model: null });
    await service.complete(OPTIONS);
    settings.getDecryptedCredentials.mockResolvedValue({ apiKey: "sk-2", model: null });
    await service.complete(OPTIONS);
    expect(requestChatCompletion.mock.calls.map((c) => c[0].apiKey)).toEqual(["sk-1", "sk-2"]);
  });
});
