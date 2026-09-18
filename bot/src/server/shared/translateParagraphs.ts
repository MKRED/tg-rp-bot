/**
 * Lossless-разбивка текста на абзацы для пер-абзацного ИИ-перевода (narrator-шаблон,
 * translatePerParagraph) — зеркало клиентской модели абзацев режима перевода
 * (webapp/src/shared/components/PromptEditorOverlay/translateBlocks.ts), тот же разделитель
 * (2+ переноса строки) и тот же lossless-инвариант: joinParagraphs(splitParagraphs(t)) === t.
 */

export interface TextParagraph {
  content: string;
  /** Разделитель (2+ переноса строки, CRLF-safe) сразу после этого абзаца; "" — последний абзац. */
  separatorAfter: string;
}

const PARAGRAPH_SEPARATOR = /((?:\r?\n){2,})/;

export function splitParagraphs(text: string): TextParagraph[] {
  if (text === "") return [];
  const parts = text.split(PARAGRAPH_SEPARATOR);
  const paragraphs: TextParagraph[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    paragraphs.push({ content: parts[i] ?? "", separatorAfter: parts[i + 1] ?? "" });
  }
  return paragraphs;
}

export function joinParagraphs(paragraphs: TextParagraph[]): string {
  return paragraphs.map((p) => p.content + p.separatorAfter).join("");
}
