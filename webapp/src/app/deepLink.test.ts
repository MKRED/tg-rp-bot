import { describe, expect, it } from "vitest";
import { computeDeepLinkRewrite } from "./deepLink";

describe("computeDeepLinkRewrite", () => {
  it("разбирает валидный deep-link на персонажа и ставит путь в hash", () => {
    expect(computeDeepLinkRewrite("?dl=%2Fcharacters%2F123")).toEqual({
      search: "",
      hash: "/characters/123",
    });
  });

  it("работает для персон", () => {
    expect(computeDeepLinkRewrite("?dl=%2Fpersonas%2F45")).toEqual({
      search: "",
      hash: "/personas/45",
    });
  });

  it("сохраняет прочие query-параметры, убирая только dl", () => {
    expect(computeDeepLinkRewrite("?foo=1&dl=%2Fcharacters%2F7&bar=2")).toEqual({
      search: "foo=1&bar=2",
      hash: "/characters/7",
    });
  });

  it("возвращает null без параметра dl", () => {
    expect(computeDeepLinkRewrite("")).toBeNull();
    expect(computeDeepLinkRewrite("?foo=1")).toBeNull();
  });

  it("отвергает пути вне белого списка (защита от внешних URL/мусора)", () => {
    expect(computeDeepLinkRewrite("?dl=%2Fchats%2F1")).toBeNull(); // не characters/personas
    expect(computeDeepLinkRewrite("?dl=https%3A%2F%2Fevil.com")).toBeNull();
    expect(computeDeepLinkRewrite("?dl=%2Fcharacters%2Fabc")).toBeNull(); // id не число
    expect(computeDeepLinkRewrite("?dl=%2Fcharacters%2F1%2F..")).toBeNull();
  });
});
