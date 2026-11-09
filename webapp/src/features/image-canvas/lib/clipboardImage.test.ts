import { describe, expect, it } from "vitest";
import { imageFromDataTransfer } from "./clipboardImage";

function transfer(files: File[]): DataTransfer {
  return { files } as unknown as DataTransfer;
}

describe("imageFromDataTransfer", () => {
  it("берёт первую картинку, текст и другие файлы пропускает", () => {
    const text = new File(["a"], "a.txt", { type: "text/plain" });
    const png = new File(["b"], "b.png", { type: "image/png" });
    expect(imageFromDataTransfer(transfer([text, png]))).toBe(png);
  });

  it("нет картинки или нет данных — null", () => {
    expect(imageFromDataTransfer(transfer([]))).toBeNull();
    expect(imageFromDataTransfer(null)).toBeNull();
  });
});
