import type { CoauthorCard } from "@tg-rp-bot/shared";
import type { Card } from "../db/schema.js";
import type { CoauthorCardData } from "./turn/prompt.js";

/**
 * Карточки чата в порядке cardIds: удалённые (их нет среди найденных) пропускаются. Выключенные
 * блоки не видны ни модели, ни на экране — их нет в генерации карточки, значит, и править их незачем.
 */
export function orderedCards(cardIds: number[], found: Card[]): Card[] {
  const byId = new Map(found.map((c) => [c.id, c]));
  return cardIds.flatMap((id) => byId.get(id) ?? []);
}

/** Карточка для модели: бриф и включённые блоки с форматом. */
export function toCardData(card: Card): CoauthorCardData {
  return {
    id: card.id,
    name: card.name,
    brief: card.prompt,
    images: card.referenceImages,
    blocks: card.categories
      .filter((c) => c.enabled)
      .map((c) => ({ id: c.id, title: c.title, format: c.description, content: c.content })),
  };
}

/** Карточка для экрана. */
export function toCardView(card: Card): CoauthorCard {
  return {
    id: card.id,
    name: card.name,
    blocks: card.categories.filter((c) => c.enabled).map((c) => ({ id: c.id, title: c.title, content: c.content })),
    imageCount: card.referenceImages.length,
  };
}
