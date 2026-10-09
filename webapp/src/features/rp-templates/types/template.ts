/** Типы фичи «RP-шаблоны» — источник промптов и порядка сборки RP-чата. */

// Контракт формы/списка, компоненты промпта и лимит — общие с сервером, живут в пакете @tg-rp-bot/shared.
import type { PromptComponentId, PromptOrderItem } from "@tg-rp-bot/shared";

export type { PromptComponentId, PromptOrderItem, RpTemplateInput, RpTemplateListItem } from "@tg-rp-bot/shared";
export { MAX_RP_TEMPLATES_PER_USER } from "@tg-rp-bot/shared";

/** Подписи компонентов запроса для блока «Порядок промптов». */
export const PROMPT_COMPONENT_LABELS: Record<PromptComponentId, string> = {
  system: "Основной промпт",
  characterDescription: "Описание персонажа",
  characterScenario: "Сценарий",
  userDescription: "Описание пользователя",
  auxiliary: "Вспомогательный промпт",
  history: "История чата",
  postHistory: "Инструкция после истории",
};

/** Откуда берётся каждый компонент — подпись под названием, чтобы пользователь понимал источник. */
export const PROMPT_COMPONENT_SOURCES: Record<PromptComponentId, string> = {
  system: "из этого шаблона",
  characterDescription: "из карточки персонажа · Промпт",
  characterScenario: "из карточки персонажа · Сценарий",
  userDescription: "из персоны · Промпт",
  auxiliary: "из этого шаблона",
  history: "сообщения чата",
  postHistory: "из этого шаблона",
};

/** Компоненты, ещё не реализованные как часть запроса — строку показываем неактивной. */
export const UNIMPLEMENTED_COMPONENTS: PromptComponentId[] = [];

/** Дефолтный порядок и включённость (userDescription выключен — пользователь включает вручную). */
export const DEFAULT_PROMPT_ORDER: PromptOrderItem[] = [
  { id: "system", enabled: true },
  { id: "characterDescription", enabled: true },
  { id: "userDescription", enabled: false },
  { id: "auxiliary", enabled: true },
  { id: "characterScenario", enabled: false },
  { id: "history", enabled: true },
  { id: "postHistory", enabled: true },
];

export type RpTemplate = {
  id: number;
  name: string;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  userPersonaPrompt: string;
  userPersonaStreaming: boolean;
  translationSystemPrompt: string;
  promptOrder: PromptOrderItem[];
};
