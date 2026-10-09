// Контракт списка/формы и лимиты — общие с сервером, живут в пакете @tg-rp-bot/shared.
export type { CharacterInput, CharacterListItem } from "@tg-rp-bot/shared";
export { MAX_CHARACTERS_PER_USER, MAX_FIRST_MESSAGES } from "@tg-rp-bot/shared";

/** Полный персонаж, как его отдаёт сервер (GET /characters/:id). */
export interface Character {
  id: number;
  name: string;
  image: string | null;
  imageFull: string | null;
  tags: string[];
  /** Примечание «для себя» — не уходит в LLM, показывается только в UI. */
  footnote: string | null;
  prompt: string;
  /** Сценарий — промпт, направляющий ИИ по ходу RP (компонент characterScenario в RP-шаблоне). */
  scenario: string;
  firstMessages: string[];
  createdAt: string;
  updatedAt: string;
}
