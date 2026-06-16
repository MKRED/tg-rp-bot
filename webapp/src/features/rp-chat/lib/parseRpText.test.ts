import { describe, expect, it } from "vitest";
import { parseRpText } from "./parseRpText";

describe("parseRpText", () => {
  it("возвращает один plain-токен для текста без разметки", () => {
    expect(parseRpText("просто текст")).toEqual([{ type: "plain", text: "просто текст" }]);
  });

  it("распознаёт действие в *звёздочках* как action (без самих звёздочек)", () => {
    expect(parseRpText("*улыбается*")).toEqual([{ type: "action", text: "улыбается" }]);
  });

  it("сохраняет кавычки у речи и угловые скобки у мысли", () => {
    expect(parseRpText('"привет"')).toEqual([{ type: "speech", text: '"привет"' }]);
    expect(parseRpText("«а если…»")).toEqual([{ type: "thought", text: "«а если…»" }]);
  });

  it("разбивает смешанный текст по сегментам, сохраняя plain между ними", () => {
    expect(parseRpText('Он *кивнул* и сказал "да"')).toEqual([
      { type: "plain", text: "Он " },
      { type: "action", text: "кивнул" },
      { type: "plain", text: " и сказал " },
      { type: "speech", text: '"да"' },
    ]);
  });

  it("корректно работает при повторном вызове (lastIndex не протекает между вызовами)", () => {
    const input = "*раз* *два*";
    expect(parseRpText(input)).toEqual(parseRpText(input));
    expect(parseRpText(input)).toEqual([
      { type: "action", text: "раз" },
      { type: "plain", text: " " },
      { type: "action", text: "два" },
    ]);
  });

  it("возвращает пустой массив для пустой строки", () => {
    expect(parseRpText("")).toEqual([]);
  });
});
