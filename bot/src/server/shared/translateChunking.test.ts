import { describe, expect, it } from "vitest";
import { chunkText, joinChunks } from "./translateChunking.js";

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
