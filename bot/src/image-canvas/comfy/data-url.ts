/** Разобранный data URL картинки. */
export interface DecodedImage {
  mime: string;
  data: Buffer;
}

/** data:image/...;base64,... → байты; null — не картинка в base64. */
export function decodeImageDataUrl(dataUrl: string): DecodedImage | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1]!.toLowerCase(), data: Buffer.from(match[2]!, "base64") };
}

export function toDataUrl(mime: string, data: Buffer): string {
  return `data:${mime};base64,${data.toString("base64")}`;
}

/** Ширина и высота PNG из заголовка IHDR; null — не PNG. */
export function pngSize(data: Buffer): { width: number; height: number } | null {
  if (data.length < 24 || data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

/** Расширение файла для загрузки в ComfyUI. */
export function extensionFor(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  return mime.replace("image/", "").replace(/[^a-z0-9]/g, "") || "png";
}
