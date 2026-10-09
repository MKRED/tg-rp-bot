import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { isNestRoute, LEGACY_ROUTES } = await import("./legacyBridge.js");

describe("isNestRoute", () => {
  const prefixes = ["/api/characters"];

  it("совпадение с префиксом и вложенные пути — Nest", () => {
    expect(isNestRoute("GET", "/api/characters", prefixes, [])).toBe(true);
    expect(isNestRoute("GET", "/api/characters/12/image/full", prefixes, [])).toBe(true);
  });

  it("похожий, но другой сегмент — не Nest", () => {
    expect(isNestRoute("GET", "/api/characters-old", prefixes, [])).toBe(false);
    expect(isNestRoute("GET", "/api/personas", prefixes, [])).toBe(false);
  });

  it("пустой список — всё в Hono", () => {
    expect(isNestRoute("GET", "/api/characters", [], [])).toBe(false);
    expect(isNestRoute("GET", "/", [], [])).toBe(false);
  });

  it("стриминговые POST чата остаются в Hono, остальное /api/chats — Nest", () => {
    const chats = ["/api/chats"];
    const legacy = (method: string, path: string) => !isNestRoute(method, path, chats, LEGACY_ROUTES);
    expect(legacy("POST", "/api/chats/5/messages")).toBe(true);
    expect(legacy("POST", "/api/chats/5/messages/9/edit")).toBe(true);
    expect(legacy("POST", "/api/chats/5/messages/9/regenerate")).toBe(true);
    expect(legacy("POST", "/api/chats/5/impersonate")).toBe(true);

    expect(legacy("GET", "/api/chats/5/impersonate")).toBe(false);
    expect(legacy("DELETE", "/api/chats/5/impersonate")).toBe(false);
    expect(legacy("POST", "/api/chats/5/messages/9/branch")).toBe(false);
    expect(legacy("POST", "/api/chats/5/messages/9/translate")).toBe(false);
    expect(legacy("DELETE", "/api/chats/5/messages/9")).toBe(false);
    expect(legacy("POST", "/api/chats")).toBe(false);
    expect(legacy("POST", "/api/chats/5/translate-text")).toBe(false);
  });
});
