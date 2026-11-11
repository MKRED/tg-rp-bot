import { describe, expect, it } from "vitest";
import { ROUTES, backTarget, hasBackTarget, parentPath } from "./routes";

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

  it("холст → список холстов", () => {
    expect(parentPath("/images/4")).toBe(ROUTES.images);
  });

  it("списки и неизвестные пути → главная", () => {
    expect(parentPath("/books")).toBe(ROUTES.home);
    expect(parentPath("/debug/llm")).toBe(ROUTES.home);
    expect(parentPath("/unknown")).toBe(ROUTES.home);
  });
});

describe("hasBackTarget", () => {
  it("на главной и на входе «Назад» нет", () => {
    expect(hasBackTarget(ROUTES.home)).toBe(false);
    expect(hasBackTarget(ROUTES.login)).toBe(false);
  });

  it("на вложенных экранах есть", () => {
    expect(hasBackTarget("/settings")).toBe(true);
    expect(hasBackTarget("/characters/3")).toBe(true);
  });
});

describe("backTarget", () => {
  it("без state — родитель по иерархии", () => {
    expect(backTarget("/cards/5/export", null)).toBe("/cards/5");
    expect(backTarget("/characters/3", undefined)).toBe(ROUTES.characters);
  });

  it("state.returnTo важнее родителя", () => {
    expect(backTarget("/characters/3", { returnTo: "/chats/9/settings" })).toBe("/chats/9/settings");
  });

  it("returnTo не строкой игнорируется", () => {
    expect(backTarget("/characters/3", { returnTo: 42 })).toBe(ROUTES.characters);
  });
});
