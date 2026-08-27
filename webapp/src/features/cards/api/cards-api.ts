import { apiFetch } from "../../../shared/api/client";
import type { AskUserQuestion, Card, CardInput, CardListItem } from "../types/card";

export function listCards(): Promise<{ cards: CardListItem[] }> {
  return apiFetch<{ cards: CardListItem[] }>("/cards");
}

export function getCard(id: number): Promise<{ card: Card }> {
  return apiFetch<{ card: Card }>(`/cards/${id}`);
}

export function createCard(input: CardInput): Promise<{ card: Card }> {
  return apiFetch<{ card: Card }>("/cards", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCard(id: number, input: CardInput): Promise<{ card: Card }> {
  return apiFetch<{ card: Card }>(`/cards/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function removeCard(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/cards/${id}`, { method: "DELETE" });
}

/**
 * Результат шага генерации блока: "done" — блок готов (уже сохранён на сервере, клиент мержит
 * точечно по categoryId — НЕ всю карточку, чтобы не затереть параллельные несохранённые правки
 * других категорий в форме); "questions" — модель попросила уточнение (ask_user) до того, как
 * сгенерировать блок; вопросы уже сохранены сервером на этой категории (см. answerCardBlockQuestions
 * ниже) — ограничения по времени на ответ нет.
 */
export type GenerateCardBlockResponse =
  | { status: "done"; categoryId: string; content: string }
  | { status: "questions"; categoryId: string; questions: AskUserQuestion[] };

/**
 * Генерирует блок карточки: без categoryId — следующий незаполненный enabled-блок, с categoryId —
 * явная перегенерация уже заполненного (см. generateCardBlock на сервере).
 */
export function generateCardBlock(id: number, categoryId?: string): Promise<GenerateCardBlockResponse> {
  return apiFetch<GenerateCardBlockResponse>(`/cards/${id}/generate`, {
    method: "POST",
    body: JSON.stringify({ categoryId }),
  });
}

/**
 * Отвечает на уточняющие вопросы (ask_user) заданной категории и запускает генерацию этого блока
 * заново с уже известными ответами в контексте — см. answerCardBlockQuestions на сервере. skipped:
 * true — пользователь отказался отвечать, модель узнаёт об этом тем же путём и не переспрашивает.
 */
export function answerCardBlockQuestions(
  id: number,
  categoryId: string,
  input: { skipped: true } | { skipped: false; answers: string[] },
): Promise<GenerateCardBlockResponse> {
  return apiFetch<GenerateCardBlockResponse>(`/cards/${id}/generate/answer`, {
    method: "POST",
    body: JSON.stringify({ categoryId, ...input }),
  });
}
