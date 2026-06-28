import type { PersonaInput } from "../../db/personas/index.js";
import { MAX_IMAGE_CHARS, MAX_IMAGE_FULL_CHARS } from "../shared/imageValidation.constants.js";
import { parseImageField } from "../shared/imageValidation.js";

/**
 * Разбирает тело запроса в PersonaInput с ручной валидацией.
 * Возвращает либо распарсенный вход, либо текст ошибки для ответа 400.
 */
export function parsePersonaInput(body: unknown): { input: PersonaInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };

  const prompt = typeof b.prompt === "string" ? b.prompt : "";

  // footnote опционален: null или отсутствие → нет сноски; строка → сноска.
  let footnote: string | null = null;
  if (b.footnote !== undefined && b.footnote !== null) {
    if (typeof b.footnote !== "string") return { error: "Footnote must be a string" };
    footnote = b.footnote;
  }

  // image/imageFull опциональны: null → нет картинки; строка обязана быть data:image/*-URL.
  const imageParsed = parseImageField(b.image, MAX_IMAGE_CHARS, "Image");
  if ("error" in imageParsed) return { error: imageParsed.error };
  const imageFullParsed = parseImageField(b.imageFull, MAX_IMAGE_FULL_CHARS, "Full image");
  if ("error" in imageFullParsed) return { error: imageFullParsed.error };

  return {
    input: { name, prompt, footnote, image: imageParsed.value, imageFull: imageFullParsed.value },
  };
}
