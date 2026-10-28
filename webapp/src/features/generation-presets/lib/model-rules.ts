import { DEFAULT_DEEPSEEK_MODEL } from "../types/preset";

/** Где действует параметр сэмплинга: применяется ли и с какого значения (DeepSeek поднимает меньшие). */
export interface ParamRule {
  applies: boolean;
  min: number;
}

/**
 * Какие параметры сэмплинга DeepSeek применяет для модели и режима (docs: create-chat-completion,
 * guides/thinking_mode). Температуру с рассуждением не применяет ни одна модель. Top P у
 * deepseek-flash действует только с рассуждением и не ниже 0.95, у deepseek-v4-pro — только без
 * рассуждения. Про модели, которых нет в документации, ничего не знаем — показываем Top P как есть.
 * model: null — модель по умолчанию сервера.
 */
export function samplingRules(model: string | null, reasoning: boolean): { temperature: ParamRule; topP: ParamRule } {
  const id = model ?? DEFAULT_DEEPSEEK_MODEL;
  const temperature = { applies: !reasoning, min: 0 };
  if (id === "deepseek-flash") return { temperature, topP: { applies: reasoning, min: reasoning ? 0.95 : 0 } };
  if (id === "deepseek-v4-pro") return { temperature, topP: { applies: !reasoning, min: 0 } };
  return { temperature, topP: { applies: true, min: 0 } };
}

/** Пояснение под параметрами: что именно DeepSeek не применит в выбранной связке. */
export function samplingHint(model: string | null, reasoning: boolean): string | null {
  const { topP } = samplingRules(model, reasoning);
  if (reasoning && !topP.applies) return "С рассуждением эта модель не применяет ни температуру, ни Top P.";
  if (reasoning) return "Температуру с рассуждением DeepSeek не применяет — её значение сохранится для «Обычного».";
  if (!topP.applies) return "Top P у этой модели действует только с рассуждением.";
  return null;
}
