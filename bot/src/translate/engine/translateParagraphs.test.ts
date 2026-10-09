import { describe, expect, it } from "vitest";
import { joinParagraphs, splitParagraphs } from "./translateParagraphs.js";

describe("splitParagraphs/joinParagraphs", () => {
  it("handles empty text", () => {
    expect(splitParagraphs("")).toEqual([]);
  });

  it("returns a single paragraph unchanged when there is no blank line", () => {
    const text = "one line\nstill same paragraph";
    expect(splitParagraphs(text)).toEqual([{ content: text, separatorAfter: "" }]);
  });

  it("splits on 2+ newlines and preserves the separator per paragraph", () => {
    const text = "First.\n\nSecond.\n\n\nThird.";
    const paragraphs = splitParagraphs(text);
    expect(paragraphs.map((p) => p.content)).toEqual(["First.", "Second.", "Third."]);
    expect(paragraphs.map((p) => p.separatorAfter)).toEqual(["\n\n", "\n\n\n", ""]);
  });

  it("is lossless for CRLF text", () => {
    const text = "First.\r\n\r\nSecond.\r\n\r\n\r\nThird.";
    const paragraphs = splitParagraphs(text);
    expect(joinParagraphs(paragraphs)).toBe(text);
  });

  it("is lossless for arbitrary text with mixed spacing", () => {
    const text = "\n\nLeading blank\n\nMiddle\ntwo-line paragraph\n\n\n\nTrailing\n\n";
    expect(joinParagraphs(splitParagraphs(text))).toBe(text);
  });
});
