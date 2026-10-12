import { describe, expect, it } from "vitest";
import { DEFAULT_KEYWORD_DEPTH } from "../types/book";
import { depthOf, selectedOf } from "./entryReference";

const ANNA = { id: 2, name: "Анна", hasImage: true };

describe("selectedOf", () => {
  it("загруженный список — источник истины (свежее имя)", () => {
    expect(selectedOf([ANNA], 2, { id: 2, name: "Старое имя", hasImage: false })).toEqual(ANNA);
  });

  it("пока список пуст — имя и аватар из сохранённой записи", () => {
    expect(selectedOf([], 2, { id: 2, name: "Анна", hasImage: true })).toEqual(ANNA);
  });

  it("выбор не совпадает с сохранённым — сохранённое не подставляем", () => {
    expect(selectedOf([], 5, { id: 2, name: "Анна", hasImage: true })).toBeNull();
  });

  it("ничего не выбрано или ссылка удалена (имени нет)", () => {
    expect(selectedOf([ANNA], null, { id: undefined, name: undefined, hasImage: undefined })).toBeNull();
    expect(selectedOf([], 2, { id: 2, name: null, hasImage: false })).toBeNull();
  });
});

describe("depthOf", () => {
  it("число — как есть, пустое поле — по умолчанию", () => {
    expect(depthOf(25)).toBe(25);
    expect(depthOf("")).toBe(DEFAULT_KEYWORD_DEPTH);
  });
});
