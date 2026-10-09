import { apiFetch } from "../../../shared/api/client";
import type { AnswerCardQuestionsInput, CardGenerationStep } from "@tg-rp-bot/shared";
import type { Card, CardInput, CardListItem } from "../types/card";

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
 * Генерирует блок карточки: без categoryId — следующий незаполненный enabled-блок, с categoryId —
 * явная перегенерация уже заполненного (см. CardGenerationService.generate на сервере).
 */
export function generateCardBlock(id: number, categoryId?: string): Promise<CardGenerationStep> {
  return apiFetch<CardGenerationStep>(`/cards/${id}/generate`, {
    method: "POST",
    body: JSON.stringify({ categoryId }),
  });
}

/**
 * Отвечает на уточняющие вопросы (ask_user) заданной категории и запускает генерацию этого блока
 * заново с уже известными ответами в контексте — см. CardGenerationService.answer на сервере. skipped:
 * true — пользователь отказался отвечать, модель узнаёт об этом тем же путём и не переспрашивает.
 */
export function answerCardBlockQuestions(
  id: number,
  categoryId: string,
  input: AnswerCardQuestionsInput,
): Promise<CardGenerationStep> {
  return apiFetch<CardGenerationStep>(`/cards/${id}/generate/answer`, {
    method: "POST",
    body: JSON.stringify({ categoryId, ...input }),
  });
}
