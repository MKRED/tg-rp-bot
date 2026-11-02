import { describe, expect, it } from "vitest";
import { buildSearchBody, mapSearchResults } from "./search-request.js";
import { SEARCH_MAX_RESULTS, SEARCH_QUERY_MAX_LENGTH, SEARCH_RESULT_MAX_CHARS } from "./web-search.constants.js";

describe("buildSearchBody", () => {
  it("короткий запрос — как есть (без пробелов по краям), со стандартным count и без content", () => {
    expect(buildSearchBody("  ведьмак геральт  ")).toEqual({
      query: "ведьмак геральт",
      count: SEARCH_MAX_RESULTS,
      need_content: false,
    });
  });

  it("длинный запрос обрезается до лимита DeepSeek", () => {
    const { query } = buildSearchBody("а".repeat(300));
    expect(query).toHaveLength(SEARCH_QUERY_MAX_LENGTH);
  });
});

describe("mapSearchResults", () => {
  it("summary → content, при пустом summary — snippet", () => {
    expect(
      mapSearchResults([
        { title: "A", url: "https://a", summary: "длинная выжимка", snippet: "кратко" },
        { title: "B", url: "https://b", summary: null, snippet: "только сниппет" },
        { title: "C", url: "https://c" },
      ]),
    ).toEqual([
      { title: "A", url: "https://a", content: "длинная выжимка" },
      { title: "B", url: "https://b", content: "только сниппет" },
      { title: "C", url: "https://c", content: "" },
    ]);
  });

  it("длинная выжимка обрезается — поиски реплеятся в промпт каждого следующего блока", () => {
    const [result] = mapSearchResults([{ title: "A", url: "https://a", summary: "б".repeat(3000) }]);
    expect(result!.content).toHaveLength(SEARCH_RESULT_MAX_CHARS);
  });

  it("нет results — пустой список", () => {
    expect(mapSearchResults(undefined)).toEqual([]);
  });
});
