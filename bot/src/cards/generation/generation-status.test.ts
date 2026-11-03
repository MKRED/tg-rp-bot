import { describe, expect, it } from "vitest";
import { GENERATION_OUTCOME_TTL_MS, GenerationStatusRegistry } from "./generation-status.js";

describe("GenerationStatusRegistry", () => {
  const setup = () => {
    let now = 1_000;
    const registry = new GenerationStatusRegistry(() => now);
    return { registry, advance: (ms: number) => (now += ms) };
  };

  it("идущая генерация — running, цель появляется после setTarget", () => {
    const { registry } = setup();
    registry.start(1, "u1");
    expect(registry.get(1, "u1")).toEqual({ state: "running" });
    registry.setTarget(1, "base");
    expect(registry.get(1, "u1")).toEqual({ state: "running", categoryId: "base" });
  });

  it("чужая карточка и неизвестная карточка — null", () => {
    const { registry } = setup();
    registry.start(1, "u1");
    expect(registry.get(1, "u2")).toBeNull();
    expect(registry.get(2, "u1")).toBeNull();
  });

  it("идущая генерация не устаревает, исход — через TTL", () => {
    const { registry, advance } = setup();
    registry.start(1, "u1");
    advance(GENERATION_OUTCOME_TTL_MS * 2);
    expect(registry.get(1, "u1")?.state).toBe("running");
    registry.finish(1, { state: "done", categoryId: "base" });
    advance(GENERATION_OUTCOME_TTL_MS - 1);
    expect(registry.get(1, "u1")).toEqual({ state: "done", categoryId: "base" });
    advance(1);
    expect(registry.get(1, "u1")).toBeNull();
  });

  it("setTarget после завершения исход не трогает", () => {
    const { registry } = setup();
    registry.start(1, "u1");
    registry.finish(1, { state: "failed", error: "generation_failed" });
    registry.setTarget(1, "base");
    expect(registry.get(1, "u1")).toEqual({ state: "failed", error: "generation_failed" });
  });
});
