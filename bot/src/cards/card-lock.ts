/**
 * Лок по cardId, общий между сохранением формы (PUT /:id, CardsService.update) и генерацией блока
 * (generateCardBlock).
 *
 * Точечные записи категорий в CardsRepository делают read-modify-write всей строки (findOne → патч
 * одной категории → persist целиком). Без общего лока параллельный PUT (сохранение формы) в узком
 * окне между этими чтением и записью мог бы затереться либо затереть чужую запись — оба пишут
 * полную строку без версии/OCC ("last writer wins"). Сериализуем оба пути через один лок на cardId,
 * как processing-lock в CLAUDE.md (Set<string|number>, снимается в finally).
 *
 * Лок держится только на время одного HTTP-запроса (включая LLM-вызовы внутри него) — пауза на
 * ask_user лок НЕ держит: вопросы сохраняются в самой категории (CardCategory в @tg-rp-bot/shared), а не в
 * состоянии процесса, и у ответа пользователя нет ограничения по времени (см.
 * server/cards/generation/generateBlock.ts, answerQuestions.ts). Раз лок никогда не удерживается
 * дольше одного ограниченного вызова, обычного Set достаточно — TTL/токен владения не нужны.
 */
const locked = new Set<number>();

/** Захватывает лок карточки. false — карточка уже занята другой операцией (PUT/generate). */
export function tryLockCard(cardId: number): boolean {
  if (locked.has(cardId)) return false;
  locked.add(cardId);
  return true;
}

/** Освобождает лок карточки. Вызывать в finally. */
export function unlockCard(cardId: number): void {
  locked.delete(cardId);
}
