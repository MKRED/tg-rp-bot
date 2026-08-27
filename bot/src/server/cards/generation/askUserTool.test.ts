import { describe, expect, it } from "vitest";
import { parseAskUserArguments } from "./askUserTool.js";

describe("parseAskUserArguments", () => {
  it("разбирает один вопрос без options", () => {
    expect(parseAskUserArguments(JSON.stringify({ questions: [{ question: "Пол персонажа?" }] }))).toEqual([
      { question: "Пол персонажа?", options: undefined },
    ]);
  });

  it("разбирает несколько вопросов с options", () => {
    const raw = JSON.stringify({
      questions: [
        { question: "Возраст?", options: ["18", "25", "30+"] },
        { question: "Раса?" },
      ],
    });
    expect(parseAskUserArguments(raw)).toEqual([
      { question: "Возраст?", options: ["18", "25", "30+"] },
      { question: "Раса?", options: undefined },
    ]);
  });

  it("обрезает пробелы у текста вопроса", () => {
    expect(parseAskUserArguments(JSON.stringify({ questions: [{ question: "  Кто?  " }] }))).toEqual([
      { question: "Кто?", options: undefined },
    ]);
  });

  it("undefined на битый JSON", () => {
    expect(parseAskUserArguments("не json")).toBeUndefined();
  });

  it("undefined без поля questions", () => {
    expect(parseAskUserArguments(JSON.stringify({}))).toBeUndefined();
  });

  it("undefined на questions не-массив", () => {
    expect(parseAskUserArguments(JSON.stringify({ questions: "нет" }))).toBeUndefined();
  });

  it("undefined на пустой массив questions", () => {
    expect(parseAskUserArguments(JSON.stringify({ questions: [] }))).toBeUndefined();
  });

  it("undefined на пустую/пробельную строку question", () => {
    expect(parseAskUserArguments(JSON.stringify({ questions: [{ question: "   " }] }))).toBeUndefined();
  });

  it("options не-массив строк вырождается в undefined, а не отклоняет весь вызов", () => {
    expect(
      parseAskUserArguments(JSON.stringify({ questions: [{ question: "Кто?", options: [1, 2] }] })),
    ).toEqual([{ question: "Кто?", options: undefined }]);
    expect(
      parseAskUserArguments(JSON.stringify({ questions: [{ question: "Кто?", options: "не массив" }] })),
    ).toEqual([{ question: "Кто?", options: undefined }]);
  });

  it("обрезает вопросы сверх ASK_USER_MAX_QUESTIONS (4)", () => {
    const questions = Array.from({ length: 6 }, (_, i) => ({ question: `Вопрос ${i}` }));
    const result = parseAskUserArguments(JSON.stringify({ questions }));
    expect(result).toHaveLength(4);
    expect(result?.map((q) => q.question)).toEqual(["Вопрос 0", "Вопрос 1", "Вопрос 2", "Вопрос 3"]);
  });
});
