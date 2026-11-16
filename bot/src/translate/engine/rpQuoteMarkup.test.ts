import { describe, expect, it } from "vitest";
import { hasQuoteTags, unwrapRpQuotes, wrapRpQuotes } from "./rpQuoteMarkup.js";

describe("wrapRpQuotes", () => {
  it('"речь" → <q>, «мысль» → <cite>, в т.ч. многострочные', () => {
    expect(wrapRpQuotes('*Смотрит.* "Куда ты?" «Он лжёт.»\n"Раз\nдва"')).toBe(
      "*Смотрит.* <q>Куда ты?</q> <cite>Он лжёт.</cite>\n<q>Раз\nдва</q>",
    );
  });

  it("непарная кавычка и пустые кавычки — как есть", () => {
    expect(wrapRpQuotes('5" дюймов')).toBe('5" дюймов');
    expect(wrapRpQuotes('""')).toBe('""');
    expect(wrapRpQuotes("«»")).toBe("«»");
  });
});

describe("unwrapRpQuotes", () => {
  it("теги → кавычки, пробелы у краёв срезаются", () => {
    expect(unwrapRpQuotes("<q> Привет! </q> <cite>Странно.</cite>")).toBe('"Привет!" «Странно.»');
  });

  it("тире в начале реплики (Яндекс) убирается, тире внутри — нет", () => {
    expect(unwrapRpQuotes("<q>- Я устал,</q> <q>— Да</q> <q>Раз - два</q>")).toBe('"Я устал," "Да" "Раз - два"');
  });

  it("туда-обратно без изменений", () => {
    const text = '*Кивает.* "Да," — сказала она. «Зачем?»\n\n"Многострочная\nреплика" 5" дюймов';
    expect(unwrapRpQuotes(wrapRpQuotes(text))).toBe(text);
  });
});

describe("hasQuoteTags", () => {
  it("находит <q>/<cite> в любом регистре", () => {
    expect(hasQuoteTags("a <Q>b</Q>")).toBe(true);
    expect(hasQuoteTags("</cite>")).toBe(true);
    expect(hasQuoteTags('<quote> "q"')).toBe(false);
  });
});
