import { apiFetch } from "../../../shared/api/client";
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
