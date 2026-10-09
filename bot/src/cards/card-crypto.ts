import type { CardCategory } from "@tg-rp-bot/shared";
import { decryptField, encryptField } from "../utils/index.js";

type FieldCipher = (value: string, key: Buffer) => string;

/** Применяет шифр ко всем текстовым полям категорий (включая ask_user), id/enabled — как есть. */
function mapCategoryTexts(categories: CardCategory[], key: Buffer, cipher: FieldCipher): CardCategory[] {
  return categories.map((c) => ({
    ...c,
    title: cipher(c.title, key),
    description: cipher(c.description, key),
    content: cipher(c.content, key),
    pendingQuestions: c.pendingQuestions?.map((q) => ({
      question: cipher(q.question, key),
      options: q.options?.map((o) => cipher(o, key)),
    })),
    askUserAnswers: c.askUserAnswers?.map((a) => ({
      question: cipher(a.question, key),
      answer: cipher(a.answer, key),
      options: a.options?.map((o) => cipher(o, key)),
    })),
  }));
}

/** Шифрует текстовые поля категорий per-user ключом (utils/crypto.ts). */
export const encryptCategories = (categories: CardCategory[], key: Buffer): CardCategory[] =>
  mapCategoryTexts(categories, key, encryptField);

/** Расшифровывает текстовые поля категорий — обратная операция encryptCategories. */
export const decryptCategories = (categories: CardCategory[], key: Buffer): CardCategory[] =>
  mapCategoryTexts(categories, key, decryptField);
