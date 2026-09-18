import { describe, expect, it } from "vitest";
import { chunkText, joinChunks, translateChunked } from "./translateChunking.js";

describe("chunkText/joinChunks", () => {
  it("returns text unchanged when under the limit", () => {
    const text = "short text";
    expect(chunkText(text, 100)).toEqual([text]);
  });

  it("is lossless for text with newlines", () => {
    const text = Array.from({ length: 50 }, (_, i) => `Line ${i} of the paragraph.`).join("\n");
    const chunks = chunkText(text, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(joinChunks(chunks)).toBe(text);
  });

  it("is lossless for text with no newlines, split by sentences", () => {
    const text = Array.from({ length: 80 }, (_, i) => `Sentence number ${i}.`).join(" ");
    const chunks = chunkText(text, 150);
    expect(chunks.length).toBeGreaterThan(1);
    expect(joinChunks(chunks)).toBe(text);
  });

  it("hard-slices and stays lossless when there is no newline or sentence boundary at all", () => {
    const text = "x".repeat(500);
    const chunks = chunkText(text, 50);
    expect(chunks.length).toBe(10);
    expect(chunks.every((c) => c.length <= 50)).toBe(true);
    expect(joinChunks(chunks)).toBe(text);
  });

  it("is lossless for CRLF text", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Row ${i}`).join("\r\n");
    const chunks = chunkText(text, 30);
    expect(joinChunks(chunks)).toBe(text);
  });

  it("handles empty text", () => {
    expect(chunkText("", 10)).toEqual([""]);
  });

  it("terminates and stays lossless on a mix of long lines and long sentence-less runs", () => {
    const text = "A".repeat(300) + "\n" + Array.from({ length: 20 }, (_, i) => `Sentence ${i}.`).join(" ");
    const chunks = chunkText(text, 40);
    expect(chunks.every((c) => c.length <= 40)).toBe(true);
    expect(joinChunks(chunks)).toBe(text);
  });
});

describe("translateChunked", () => {
  // Симулирует aiTranslate: переводчик возвращает результат уже без крайних пробелов/переносов —
  // именно так реальный aiTranslate триммит ответ модели (translate.ts).
  const trimmingTranslate = async (chunk: string): Promise<string> => chunk.toLowerCase().trim();

  it("returns text unchanged when it is only whitespace, without calling translateOne", async () => {
    const translateOne = async (): Promise<string> => {
      throw new Error("must not be called");
    };
    await expect(translateChunked("  \n\n  ", 100, translateOne)).resolves.toBe("  \n\n  ");
  });

  it("preserves a paragraph break at the chunk boundary even when translateOne trims its result", async () => {
    // maxChars подобран так, чтобы chunkText разрезал ровно на границе "\n\n" (см. chunkText: первым
    // приоритетом режет по переносам строк) — воспроизводит реальный сценарий бага.
    const text = "A".repeat(30) + "\n\n" + "B".repeat(30);
    const chunks = chunkText(text, 32);
    expect(chunks).toEqual(["A".repeat(30) + "\n\n", "B".repeat(30)]);

    const result = await translateChunked(text, 32, trimmingTranslate);
    expect(result).toBe("a".repeat(30) + "\n\n" + "b".repeat(30));
  });

  it("preserves internal newlines split mid-chunk even when translateOne trims its result", async () => {
    const text = Array.from({ length: 20 }, (_, i) => `Line ${i}`).join("\n");
    const chunks = chunkText(text, 25);
    expect(chunks.length).toBeGreaterThan(1);

    const result = await translateChunked(text, 25, trimmingTranslate);
    expect(result).toBe(text.toLowerCase());
  });

  it("delegates whole text to translateOne unchanged when under maxChars", async () => {
    const translateOne = async (chunk: string): Promise<string> => `[${chunk}]`;
    await expect(translateChunked("hello", 100, translateOne)).resolves.toBe("[hello]");
  });
});
