/**
 * Публичная поверхность фичи «карточки» — то, что потребляют страницы.
 * Внутрифичевые модули импортируют друг друга напрямую по файлам, НЕ через этот barrel
 * (иначе цикл, который компилируется, но даёт undefined в рантайме).
 */
export { CardForm } from "./components/CardForm";
export { useCards } from "./hooks/useCards";
export { useCard } from "./hooks/useCard";
export { getCard, createCard, updateCard, removeCard } from "./api/cards-api";
export type { Card, CardInput, CardListItem } from "./types/card";
export { MAX_CARDS_PER_USER } from "./types/card";
