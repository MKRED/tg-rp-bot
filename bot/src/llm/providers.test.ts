import { beforeEach, describe, expect, it, vi } from "vitest";

// config тянет requireEnv(BOT_TOKEN/DATABASE_URL) — мокаем, чтобы тест не требовал .env.
// Мутабельный объект: меняем llmProvider между кейсами.
const mockConfig = {
  llmProvider: "openrouter",
  openRouterApiKey: "or-key",
  openRouterModel: "openai/gpt-4o-mini",
  deepSeekApiKey: "ds-key",
  deepSeekModel: "deepseek-v4-flash",
};
vi.mock("../config.js", () => ({ config: mockConfig }));

const { getActiveProvider, mapEffort } = await import("./providers.js");

beforeEach(() => {
  mockConfig.llmProvider = "openrouter";
});

describe("mapEffort", () => {
  it("xhigh → max", () => {
    expect(mapEffort("xhigh")).toBe("max");
  });

  it("остальные уровни и пустое значение → high", () => {
    for (const e of ["minimal", "low", "medium", "high", undefined, null]) {
      expect(mapEffort(e)).toBe("high");
    }
  });
});

describe("getActiveProvider", () => {
  it("openrouter: base URL, app-заголовки, reasoning не добавляется", () => {
    mockConfig.llmProvider = "openrouter";
    const p = getActiveProvider();
    expect(p.name).toBe("openrouter");
    expect(p.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(p.appHeaders).toBeDefined();
    // Тело OpenRouter не трогаем — reasoning всегда пустой.
    expect(p.reasoningBody({ messages: [], requestReasoning: true, reasoningEffort: "xhigh" })).toEqual(
      {},
    );
  });

  it("deepseek: base URL, без app-заголовков", () => {
    mockConfig.llmProvider = "deepseek";
    const p = getActiveProvider();
    expect(p.name).toBe("deepseek");
    expect(p.baseUrl).toBe("https://api.deepseek.com");
    expect(p.appHeaders).toBeUndefined();
  });

  it("неизвестный провайдер → openrouter (фолбэк)", () => {
    mockConfig.llmProvider = "whatever";
    expect(getActiveProvider().name).toBe("openrouter");
  });
});

describe("deepseek reasoningBody", () => {
  beforeEach(() => {
    mockConfig.llmProvider = "deepseek";
  });

  it("выключенное мышление → thinking disabled", () => {
    const body = getActiveProvider().reasoningBody({ messages: [], requestReasoning: false });
    expect(body).toEqual({ thinking: { type: "disabled" } });
  });

  it("включённое мышление → thinking enabled + смаппленный effort", () => {
    const body = getActiveProvider().reasoningBody({
      messages: [],
      requestReasoning: true,
      reasoningEffort: "xhigh",
    });
    expect(body).toEqual({ thinking: { type: "enabled" }, reasoning_effort: "max" });
  });

  it("включённое мышление без уровня → high", () => {
    const body = getActiveProvider().reasoningBody({ messages: [], requestReasoning: true });
    expect(body).toEqual({ thinking: { type: "enabled" }, reasoning_effort: "high" });
  });
});
