import { describe, expect, it } from "vitest";
import { generateAgentToken, hashAgentToken, parseAgentBearer } from "./agent-token.js";

describe("agent-token", () => {
  it("выпускает разные токены с префиксом", () => {
    const a = generateAgentToken();
    const b = generateAgentToken();
    expect(a).toMatch(/^cagt_[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("хеш стабилен и не совпадает с токеном", () => {
    const t = generateAgentToken();
    expect(hashAgentToken(t)).toBe(hashAgentToken(t));
    expect(hashAgentToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("достаёт токен из Bearer и отвергает чужие форматы", () => {
    const t = generateAgentToken();
    expect(parseAgentBearer(`Bearer ${t}`)).toBe(t);
    expect(parseAgentBearer(`bearer   ${t}`)).toBe(t);
    expect(parseAgentBearer(undefined)).toBeNull();
    expect(parseAgentBearer("Bearer abc")).toBeNull();
    expect(parseAgentBearer(`tma ${t}`)).toBeNull();
  });
});
