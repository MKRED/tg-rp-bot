import { describe, expect, it } from "vitest";
import { ROUTES, parentPath } from "./routes";

describe("parentPath", () => {
  it("запись книги знаний → её книга", () => {
    expect(parentPath("/books/7/entries/new")).toBe("/books/7");
    expect(parentPath("/books/7/entries/42")).toBe("/books/7");
  });

  it("книга знаний → список книг", () => {
    expect(parentPath("/books/7")).toBe(ROUTES.books);
    expect(parentPath("/books/new")).toBe(ROUTES.books);
  });

  it("настройки и граф истории → сама история", () => {
    expect(parentPath("/stories/3/settings")).toBe("/stories/3");
    expect(parentPath("/stories/3/graph")).toBe("/stories/3");
  });

  it("выгрузка карточки → карточка, правка → список", () => {
    expect(parentPath("/cards/5/export")).toBe("/cards/5");
    expect(parentPath("/cards/5")).toBe(ROUTES.cards);
  });

  it("списки и неизвестные пути → главная", () => {
    expect(parentPath("/books")).toBe(ROUTES.home);
    expect(parentPath("/debug/llm")).toBe(ROUTES.home);
    expect(parentPath("/unknown")).toBe(ROUTES.home);
  });
});
