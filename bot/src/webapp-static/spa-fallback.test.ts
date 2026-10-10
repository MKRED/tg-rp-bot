import { describe, expect, it } from "vitest";
import { shouldServeSpaIndex } from "./spa-fallback.js";

describe("shouldServeSpaIndex", () => {
  it.each(["/", "/characters/5", "/stories/12/settings", "/apidocs", "/healthy"])("GET %s — страница приложения", (path) => {
    expect(shouldServeSpaIndex("GET", path)).toBe(true);
  });

  it.each(["/api", "/api/unknown", "/api/chats/5", "/health", "/health/x"])("GET %s — дальше в Nest", (path) => {
    expect(shouldServeSpaIndex("GET", path)).toBe(false);
  });

  it.each(["/assets/index-old.js", "/favicon.ico", "/index.html"])("GET %s — файла нет в сборке: 404, не страница", (path) => {
    expect(shouldServeSpaIndex("GET", path)).toBe(false);
  });

  it("HEAD как GET; POST и прочие методы — дальше в Nest", () => {
    expect(shouldServeSpaIndex("HEAD", "/characters")).toBe(true);
    expect(shouldServeSpaIndex("POST", "/characters")).toBe(false);
  });
});
