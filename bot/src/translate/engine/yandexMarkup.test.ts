import { describe, expect, it } from "vitest";
import { fromYandexHtml, toYandexHtml } from "./yandexMarkup.js";

describe("toYandexHtml", () => {
  it("действия *…* → <i>…</i>, в т.ч. в начале текста и после переноса", () => {
    expect(toYandexHtml("*Марта кивает.*\n\n*Дождь.*")).toBe("<i>Марта кивает.</i>\n\n<i>Дождь.</i>");
  });

  it('"речь" и «мысли» → <q>/<cite>, в т.ч. внутри действия', () => {
    expect(toYandexHtml('*Кивает.* "Да." «Зачем?» *шепчет "стой"*')).toBe(
      "<i>Кивает.</i> <q>Да.</q> <cite>Зачем?</cite> <i>шепчет <q>стой</q></i>",
    );
  });

  it("свои & < > экранируются — не становятся разметкой", () => {
    expect(toYandexHtml("5 < 7 & <b>тег</b>")).toBe("5 &lt; 7 &amp; &lt;b&gt;тег&lt;/b&gt;");
  });

  it("непарная звёздочка, пробелы у краёв и действие через перенос строки — как есть", () => {
    expect(toYandexHtml("звезда * одна")).toBe("звезда * одна");
    expect(toYandexHtml("a * b * c")).toBe("a * b * c");
    expect(toYandexHtml("*a*")).toBe("<i>a</i>");
    expect(toYandexHtml("*начало\nконец*")).toBe("*начало\nконец*");
  });

  it("** вокруг слова: внутренняя пара — курсив, внешние звёздочки остаются", () => {
    expect(toYandexHtml("**жирный**")).toBe("*<i>жирный</i>*");
  });
});

describe("fromYandexHtml", () => {
  it("<i>…</i> → *…*, пробелы у краёв курсива срезаются", () => {
    expect(fromYandexHtml("He smiled. <i> I wonder.</i> Go.")).toBe("He smiled. *I wonder.* Go.");
  });

  it("сущности → символы, &amp; — последним (не раскодируем дважды)", () => {
    expect(fromYandexHtml("5 &lt; 7 &amp; &quot;q&quot; &#39;a&#39; &amp;lt;")).toBe(`5 < 7 & "q" 'a' &lt;`);
  });

  it("теги кавычек → кавычки; свой текст &lt;q&gt; тегом не становится", () => {
    expect(fromYandexHtml("<q>- Я устал,</q> - сказал он. <cite>Странно.</cite> &lt;q&gt;")).toBe(
      '"Я устал," - сказал он. «Странно.» <q>',
    );
  });

  it("туда-обратно без изменений", () => {
    const text = '*Марта кивает.* «Второй этаж.» "Идём."\n\nЦена 5 < 7 & **важно** * одна\nстрока';
    expect(fromYandexHtml(toYandexHtml(text))).toBe(text);
  });
});
