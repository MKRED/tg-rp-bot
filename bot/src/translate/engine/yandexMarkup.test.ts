import { describe, expect, it } from "vitest";
import { fromYandexHtml, toYandexHtml } from "./yandexMarkup.js";

describe("toYandexHtml", () => {
  it("действия *…* → <i>…</i>, в т.ч. в начале текста и после переноса", () => {
    expect(toYandexHtml("*Марта кивает.* «Да.»\n\n*Дождь.*")).toBe("<i>Марта кивает.</i> «Да.»\n\n<i>Дождь.</i>");
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

  it("туда-обратно без изменений", () => {
    const text = "*Марта кивает.* «Второй этаж.»\n\nЦена 5 < 7 & **важно** * одна\nстрока";
    expect(fromYandexHtml(toYandexHtml(text))).toBe(text);
  });
});
