import type { CardCategory, CardTemplateInput } from "@tg-rp-bot/shared";

/** Что из карточки уходит в шаблон: всё, кроме персонажа (основной промпт, референсы, пресет, тексты). */
export interface CardTemplateSource {
  systemPrompt: string;
  categories: CardCategory[];
  useWebSearch: boolean;
  useAskUser: boolean;
  askUserFirst: boolean;
}

/**
 * «Сохранить как шаблон»: структура карточки без сгенерированного текста и контекста инструментов.
 * onlyEnabled — выключенные поля в шаблон не берутся.
 */
export function cardToTemplate(name: string, card: CardTemplateSource, onlyEnabled: boolean): CardTemplateInput {
  return {
    name: name.trim(),
    systemPrompt: card.systemPrompt,
    fields: card.categories
      .filter((c) => !onlyEnabled || c.enabled)
      .map(({ id, title, description, enabled }) => ({ id, title, description, enabled })),
    useWebSearch: card.useWebSearch,
    useAskUser: card.useAskUser,
    askUserFirst: card.askUserFirst,
  };
}
