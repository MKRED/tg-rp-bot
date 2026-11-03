import type { CardCategory, CardField } from "@tg-rp-bot/shared";
import { decryptField, encryptField } from "../utils/index.js";

type FieldCipher = (value: string, key: Buffer) => string;

/** Применяет шифр ко всем текстовым полям категорий (включая ask_user и веб-поиски), id/enabled — как есть. */
function mapCategoryTexts(categories: CardCategory[], key: Buffer, cipher: FieldCipher): CardCategory[] {
  return categories.map((c) => ({
    ...c,
    title: cipher(c.title, key),
    description: cipher(c.description, key),
    content: cipher(c.content, key),
    pendingQuestions: c.pendingQuestions?.map((q) => ({
      question: cipher(q.question, key),
      options: q.options?.map((o) => cipher(o, key)),
      ...(q.recommended !== undefined && { recommended: cipher(q.recommended, key) }),
    })),
    askUserAnswers: c.askUserAnswers?.map((a) => ({
      question: cipher(a.question, key),
      answer: cipher(a.answer, key),
      options: a.options?.map((o) => cipher(o, key)),
      ...(a.recommended !== undefined && { recommended: cipher(a.recommended, key) }),
      // Флаг, не текст: без явного переноса дополнение пользователя после записи стало бы «ответом».
      ...(a.unprompted && { unprompted: true as const }),
    })),
    webSearches: c.webSearches?.map((s) => ({
      query: cipher(s.query, key),
      results: s.results.map((r) => ({
        title: cipher(r.title, key),
        url: cipher(r.url, key),
        content: cipher(r.content, key),
      })),
    })),
  }));
}

/** Шифрует текстовые поля категорий per-user ключом (utils/crypto.ts). */
export const encryptCategories = (categories: CardCategory[], key: Buffer): CardCategory[] =>
  mapCategoryTexts(categories, key, encryptField);

/** Расшифровывает текстовые поля категорий — обратная операция encryptCategories. */
export const decryptCategories = (categories: CardCategory[], key: Buffer): CardCategory[] =>
  mapCategoryTexts(categories, key, decryptField);

/** Поля шаблона карточки: шифруются те же title/description, что у категорий карточки. */
function mapFieldTexts(fields: CardField[], key: Buffer, cipher: FieldCipher): CardField[] {
  return fields.map((f) => ({ ...f, title: cipher(f.title, key), description: cipher(f.description, key) }));
}

/** Шифрует title/description полей шаблона per-user ключом. */
export const encryptFields = (fields: CardField[], key: Buffer): CardField[] => mapFieldTexts(fields, key, encryptField);

/** Расшифровывает поля шаблона — обратная операция encryptFields. */
export const decryptFields = (fields: CardField[], key: Buffer): CardField[] => mapFieldTexts(fields, key, decryptField);
