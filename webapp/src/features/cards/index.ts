/**
 * Публичная поверхность фичи «карточки» — то, что потребляют страницы.
 * Внутрифичевые модули импортируют друг друга напрямую по файлам, НЕ через этот barrel
 * (иначе цикл, который компилируется, но даёт undefined в рантайме).
 */
export { CardForm } from "./components/CardForm";
export { CardTemplateForm } from "./components/CardTemplateForm";
export { useCardTemplates } from "./hooks/useCardTemplates";
export { useCardTemplate } from "./hooks/useCardTemplate";
export { createCardTemplate, updateCardTemplate, removeCardTemplate } from "./api/card-templates-api";
export type { CardTemplate, CardTemplateInput } from "./types/cardTemplate";
export { MAX_CARD_TEMPLATES_PER_USER, STANDARD_CARD_TEMPLATE } from "./types/cardTemplate";
export { useCards } from "./hooks/useCards";
export { useCard } from "./hooks/useCard";
export {
  getCard,
  createCard,
  updateCard,
  removeCard,
  generateCardBlock,
  answerCardBlockQuestions,
} from "./api/cards-api";
export { assembleExportPrompt } from "./lib/assembleExportPrompt";
export type { Card, CardCategory, CardInput, CardListItem, CardPresetOption } from "./types/card";
export {
  DEFAULT_CARD_CATEGORIES,
  DEFAULT_CARD_PROMPT,
  MAX_CARD_CATEGORIES,
  MAX_CARDS_PER_USER,
} from "./types/card";
