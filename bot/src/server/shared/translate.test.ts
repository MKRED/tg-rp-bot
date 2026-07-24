import { describe, expect, it, vi } from "vitest";

// translate.ts тянет chatCompletion (→ config.ts, requireEnv BOT_TOKEN/DATABASE_URL) и logger —
// мокаем оба, тестируем только чистую resolveTranslationReasoning.
vi.mock("../../llm/client.js", () => ({ chatCompletion: vi.fn() }));
vi.mock("../../logger.js", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { resolveTranslationReasoning } = await import("./translate.js");

describe("resolveTranslationReasoning", () => {
  it('"off" → рассуждение отключено, эффорт не передаётся', () => {
    expect(resolveTranslationReasoning("off")).toEqual({ requestReasoning: false });
  });

  it("конкретный уровень → форсирует рассуждение с этим эффортом", () => {
    expect(resolveTranslationReasoning("minimal")).toEqual({
      requestReasoning: true,
      reasoningEffort: "minimal",
    });
  });

  it("high → рассуждение включено с эффортом high", () => {
    expect(resolveTranslationReasoning("high")).toEqual({
      requestReasoning: true,
      reasoningEffort: "high",
    });
  });

  it("null (защитный кейс — шаблон не резолвился) → фолбэк на дефолт (medium)", () => {
    expect(resolveTranslationReasoning(null)).toEqual({
      requestReasoning: true,
      reasoningEffort: "medium",
    });
  });

  it("undefined → фолбэк на дефолт (medium)", () => {
    expect(resolveTranslationReasoning(undefined)).toEqual({
      requestReasoning: true,
      reasoningEffort: "medium",
    });
  });
});
