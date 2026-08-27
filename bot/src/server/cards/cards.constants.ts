// Мягкий лимит (дублируется в webapp для блокировки UI — здесь последняя линия защиты).
export const MAX_CARDS_PER_USER = 50;

// Максимум категорий структуры на карточку (как MAX_FIRST_MESSAGES у персонажа) — защита от абьюза.
export const MAX_CARD_CATEGORIES = 30;
