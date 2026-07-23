import type { StoryPromptOrderItem } from "../../../db/schema.js";
import type { StoryMessageInPath } from "../../../db/stories/index.js";
import type { TrimInfo } from "../budget.js";

export type StoryPromptOptions = {
  /** Нарратор-инструкция (systemPrompt шаблона или дефолт). */
  systemPrompt: string;
  /** Вспомогательный системный промпт из шаблона (опц.). */
  auxiliarySystemPrompt: string;
  /** Инструкция «после истории» из шаблона. */
  postHistoryInstruction: string;
  /** Системная вводная истории (опц.). */
  premise: string;
  /** Тексты always_on-записей книги знаний (уже отфильтрованы и резолвнуты). */
  lorebook: string[];
  /** Готовые пересказы сжатых сообщений активной ветки (compact), по порядку. Пусто/нет = нет сжатия. */
  compactSummaries?: string[];
  /** Активный путь истории; последний узел — живой триггер (user-ход текущей генерации). */
  history: StoryMessageInPath[];
  /** Порядок и включённость компонентов запроса (из шаблона или DEFAULT_NARRATOR_PROMPT_ORDER). */
  promptOrder: StoryPromptOrderItem[];
  /** Текст нейтрализации отыгранных user-ходов (см. CONTINUE_MARKER). Резолвится вызывающим кодом. */
  continueMarker: string;
  /** Текст синтетического leading-user перед корнем (см. LEADING_USER_MARKER). */
  leadingUserMarker: string;
  contextUnlimited?: boolean;
  contextSize?: number | null;
  maxTokens?: number | null;
  onTrim?: (info: TrimInfo) => void;
  /** Урезать историю под лимит контекста. false → история целиком (для экрана статистики). Дефолт true. */
  trim?: boolean;
};
