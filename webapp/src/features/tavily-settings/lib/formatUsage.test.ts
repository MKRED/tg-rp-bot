import { describe, expect, it } from "vitest";
import type { TavilyUsage } from "../types/tavilySettings";
import { formatUsageDescription, formatUsageSubtitle } from "./formatUsage";

const usage: TavilyUsage = {
  plan: "Researcher",
  planUsage: 30,
  planLimit: 1000,
};

describe("formatUsageSubtitle", () => {
  it("shows loading state first", () => {
    expect(formatUsageSubtitle(usage, true)).toBe("Загрузка…");
  });

  it("shows fallback when there is no data", () => {
    expect(formatUsageSubtitle(null, false)).toBe("Не удалось загрузить");
  });

  it("shows usage against the plan limit", () => {
    expect(formatUsageSubtitle(usage, false)).toBe("30 / 1000 запросов");
  });

  it("shows plain usage count when there is no limit", () => {
    expect(formatUsageSubtitle({ ...usage, planLimit: null }, false)).toBe("30 запросов");
  });
});

describe("formatUsageDescription", () => {
  it("returns undefined when there is no data", () => {
    expect(formatUsageDescription(null)).toBeUndefined();
  });

  it("shows the plan name", () => {
    expect(formatUsageDescription(usage)).toBe("план Researcher");
  });
});
