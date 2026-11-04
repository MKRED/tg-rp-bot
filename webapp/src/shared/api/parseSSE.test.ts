import { describe, expect, it } from "vitest";
import { parseSSELines } from "./parseSSE";

describe("parseSSELines", () => {
  it("собирает событие из пары строк event:/data:", () => {
    expect(parseSSELines(["event: token", 'data: {"text":"привет"}'])).toEqual([
      { event: "token", data: { text: "привет" } },
    ]);
  });

  it("парсит несколько событий подряд", () => {
    const lines = [
      "event: userMessage",
      'data: {"id":1}',
      "event: token",
      'data: {"text":"a"}',
      "event: done",
      'data: {"id":2}',
    ];
    expect(parseSSELines(lines)).toEqual([
      { event: "userMessage", data: { id: 1 } },
      { event: "token", data: { text: "a" } },
      { event: "done", data: { id: 2 } },
    ]);
  });

  it("игнорирует data с битым JSON, не ломая остальной поток", () => {
    const lines = ["event: token", "data: {не json}", "event: token", 'data: {"text":"ok"}'];
    expect(parseSSELines(lines)).toEqual([{ event: "token", data: { text: "ok" } }]);
  });

  it("игнорирует пустые/посторонние строки между событиями", () => {
    const lines = ["", "event: reset", "data: {}", ": keep-alive"];
    expect(parseSSELines(lines)).toEqual([{ event: "reset", data: {} }]);
  });

  it("сбрасывает имя события после каждого data (event не протекает на следующий блок)", () => {
    // У второго data нет своей строки event: — currentEvent уже сброшен в "".
    const lines = ["event: token", 'data: {"text":"a"}', 'data: {"text":"b"}'];
    expect(parseSSELines(lines)).toEqual([
      { event: "token", data: { text: "a" } },
      { event: "", data: { text: "b" } },
    ]);
  });
});
