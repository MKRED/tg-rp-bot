import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { isNestRoute } = await import("./legacyBridge.js");

describe("isNestRoute", () => {
  const prefixes = ["/api/characters"];

  it("совпадение с префиксом и вложенные пути — Nest", () => {
    expect(isNestRoute("/api/characters", prefixes)).toBe(true);
    expect(isNestRoute("/api/characters/12/image/full", prefixes)).toBe(true);
  });

  it("похожий, но другой сегмент — не Nest", () => {
    expect(isNestRoute("/api/characters-old", prefixes)).toBe(false);
    expect(isNestRoute("/api/personas", prefixes)).toBe(false);
  });

  it("пустой список — всё в Hono", () => {
    expect(isNestRoute("/api/characters", [])).toBe(false);
    expect(isNestRoute("/", [])).toBe(false);
  });
});
