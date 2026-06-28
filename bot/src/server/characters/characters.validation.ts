import type { CharacterInput } from "../../db/characters/index.js";
import { MAX_IMAGE_CHARS, MAX_IMAGE_FULL_CHARS } from "../shared/imageValidation.constants.js";
import { parseImageField } from "../shared/imageValidation.js";
import { MAX_FIRST_MESSAGES } from "./characters.constants.js";

/**
 * Разбирает тело запроса в CharacterInput с ручной валидацией (без отдельной зависимости).
 * Возвращает либо распарсенный вход, либо текст ошибки для ответа 400.
 */
export function parseCharacterInput(body: unknown): { input: CharacterInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };

  const prompt = typeof b.prompt === "string" ? b.prompt : "";
  const scenario = typeof b.scenario === "string" ? b.scenario : "";

  if (!Array.isArray(b.tags) || !b.tags.every((t) => typeof t === "string")) {
    return { error: "Tags must be an array of strings" };
  }
  if (!Array.isArray(b.firstMessages) || !b.firstMessages.every((m) => typeof m === "string")) {
    return { error: "firstMessages must be an array of strings" };
  }
  if (b.firstMessages.length > MAX_FIRST_MESSAGES) {
    return { error: `Too many first messages (max ${MAX_FIRST_MESSAGES})` };
  }

  // footnote опционален: null/отсутствие/пустая строка → нет примечания; непустая строка → примечание.
  let footnote: string | null = null;
  if (b.footnote !== undefined && b.footnote !== null) {
    if (typeof b.footnote !== "string") return { error: "Footnote must be a string" };
    footnote = b.footnote || null; // защита «последнего рубежа»: пустую строку храним как null
  }

  // image/imageFull опциональны: отсутствует/null → нет картинки; строка обязана быть data:image/*-URL.
  const imageParsed = parseImageField(b.image, MAX_IMAGE_CHARS, "Image");
  if ("error" in imageParsed) return { error: imageParsed.error };
  const imageFullParsed = parseImageField(b.imageFull, MAX_IMAGE_FULL_CHARS, "Full image");
  if ("error" in imageFullParsed) return { error: imageFullParsed.error };

  return {
    input: {
      name,
      prompt,
      scenario,
      tags: b.tags as string[],
      footnote,
      firstMessages: b.firstMessages as string[],
      image: imageParsed.value,
      imageFull: imageFullParsed.value,
    },
  };
}
