import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { isNestRoute } = await import("./legacyBridge.js");

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

  it("LEGACY_ROUTES: совпадение метода и пути оставляет запрос в Hono, остальное префикса — Nest", () => {
    const legacyRoutes = [{ method: "POST", path: /^\/api\/chats\/[^/]+\/messages$/ }];
    const legacy = (method: string, path: string) => !isNestRoute(method, path, ["/api/chats"], legacyRoutes);
    expect(legacy("POST", "/api/chats/5/messages")).toBe(true);
    expect(legacy("GET", "/api/chats/5/messages")).toBe(false);
    expect(legacy("POST", "/api/chats/5/messages/9/branch")).toBe(false);
    expect(legacy("POST", "/api/chats")).toBe(false);
  });

  it("stories: в Hono только advance, регенерация и ручное сжатие", () => {
    const legacy = (method: string, path: string) => !isNestRoute(method, path);
    expect(legacy("POST", "/api/stories/5/advance")).toBe(true);
    expect(legacy("POST", "/api/stories/5/messages/9/regenerate")).toBe(true);
    expect(legacy("POST", "/api/stories/5/compact")).toBe(true);
    expect(legacy("GET", "/api/stories/5/compactions")).toBe(false);
    expect(legacy("POST", "/api/stories/5/messages/9/edit")).toBe(false);
    expect(legacy("GET", "/api/stories")).toBe(false);
  });
});
