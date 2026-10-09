import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { contextLimitOf } = await import("./chat-stats.service.js");

describe("contextLimitOf", () => {
  it("окно пресета; безграничный, незаданный размер или нет пресета — null", () => {
    expect(contextLimitOf({ contextUnlimited: false, contextSize: 32000 })).toBe(32000);
    expect(contextLimitOf({ contextUnlimited: true, contextSize: 32000 })).toBeNull();
    expect(contextLimitOf({ contextUnlimited: false, contextSize: null })).toBeNull();
    expect(contextLimitOf(null)).toBeNull();
  });
});
