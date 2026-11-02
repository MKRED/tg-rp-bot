// Контракт шаблонов карточек (форма, шаблон, лимит, встроенный «Стандартный») — общий с сервером,
// живёт в @tg-rp-bot/shared. Реэкспорт сохраняет barrel фичи.
export type { CardField, CardTemplate, CardTemplateInput } from "@tg-rp-bot/shared";
export { MAX_CARD_TEMPLATES_PER_USER, STANDARD_CARD_TEMPLATE } from "@tg-rp-bot/shared";
