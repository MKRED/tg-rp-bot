import type { PromptComponentId } from "../../db/schema.js";
import type { GenerationPreset } from "../../db/schema.js";
import type { MessageInPath } from "../../db/chats/index.js";
import type { ChatMessage } from "../../llm/types.js";
import { countTokens } from "../../utils/index.js";
import { DEFAULT_OUTPUT_RESERVE, PER_MESSAGE_OVERHEAD, trimHistoryToBudget } from "./budget.js";
import { DEFAULT_IMPERSONATE_TEMPLATE, IMPERSONATE_HISTORY_LIMIT } from "./promptBuilder.constants.js";
import type {
  BuildMessagesControl,
  BuildMessagesOptions,
  ImpersonateOptions,
} from "./promptBuilder.types.js";

// Реэкспорт публичной поверхности билдера для потребителей (хендлеры импортируют отсюда).
export { trimHistoryToBudget } from "./budget.js";
export { DEFAULT_IMPERSONATE_TEMPLATE } from "./promptBuilder.constants.js";
export type {
  BuildMessagesControl,
  BuildMessagesOptions,
  ImpersonateOptions,
  PromptCharacter,
  PromptPersona,
} from "./promptBuilder.types.js";
export type { TrimInfo } from "./budget.js";

/**
 * Заменяет плейсхолдеры {{char}} и {{user}} на имена персонажа и персоны.
 * Регистронезависимо: {{Char}}, {{CHAR}}, {{User}}, {{USER}} и т.д.
 * Если персона не задана — подставляется "User".
 */
export function replacePlaceholders(text: string, charName: string, userName: string): string {
  return text
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{user\}\}/gi, userName);
}

/** Текст не-history компонента запроса (до подстановки плейсхолдеров) или null, если он пуст. */
function componentText(opts: BuildMessagesOptions, id: Exclude<PromptComponentId, "history">): string | null {
  switch (id) {
    case "system":
      return opts.preset.systemPrompt || null;
    case "characterDescription":
      return opts.character.prompt || null;
    case "characterScenario":
      // Сценарий — авторская «вводная» для ИИ (куда ведём сцену), а не реплика игрока,
      // поэтому уходит системным сообщением, как и описание персонажа.
      return opts.character.scenario || null;
    case "userDescription":
      // Показываем персону, только если она задана (компонент может быть включён без персоны).
      return opts.persona?.prompt || null;
    case "auxiliary":
      return opts.preset.auxiliarySystemPrompt || null;
    case "postHistory":
      return opts.preset.postHistoryInstruction || null;
  }
}

/**
 * Возвращает историю, урезанную под лимит контекста пресета. Безграничный контекст или незаданный
 * contextSize → история без изменений. Иначе из contextSize вычитаем резерв под ответ и стоимость
 * фиксированных компонентов (system/персонаж/персона/aux/post-history + новая реплика игрока), а из
 * истории отбрасываем самые старые сообщения, пока остаток не уложится в бюджет.
 */
function resolveHistory(opts: BuildMessagesOptions, sub: (t: string) => string): MessageInPath[] {
  const { preset, history } = opts;
  if (preset.contextUnlimited || preset.contextSize == null) return history;

  const reserve = preset.maxTokens ?? DEFAULT_OUTPUT_RESERVE;
  // Стоимость фиксированных частей запроса: их урезать нельзя, поэтому вычитаем из бюджета истории.
  let fixed = countTokens(sub(opts.userMessage)) + PER_MESSAGE_OVERHEAD;
  for (const item of preset.promptOrder) {
    if (!item.enabled || item.id === "history") continue;
    const text = componentText(opts, item.id);
    if (text) fixed += countTokens(sub(text)) + PER_MESSAGE_OVERHEAD;
  }

  const available = preset.contextSize - reserve - fixed;
  return trimHistoryToBudget(
    history,
    available,
    (msg) => countTokens(sub(msg.content)) + PER_MESSAGE_OVERHEAD,
  );
}

/**
 * Собирает массив ChatMessage[] для отправки в LLM.
 * Порядок компонентов определяется preset.promptOrder; отключённые/пустые компоненты пропускаются.
 * Во всех текстах автоматически заменяются {{char}} и {{user}} на имена персонажа/персоны.
 *
 *   system / characterDescription / characterScenario / userDescription / auxiliary → role:"system"
 *   history     → MessageInPath[] → {role, content}[] (урезается под preset.contextSize, см. resolveHistory)
 *   postHistory → role:"user", preset.postHistoryInstruction
 *
 * После всех компонентов добавляется новое сообщение пользователя (userMessage).
 */
export function buildMessages(opts: BuildMessagesOptions, ctl: BuildMessagesControl = {}): ChatMessage[] {
  const { preset, character, persona, userMessage } = opts;
  const charName = character.name;
  const userName = persona?.name ?? "User";
  const sub = (text: string) => replacePlaceholders(text, charName, userName);

  const history = ctl.trim === false ? opts.history : resolveHistory(opts, sub);
  const dropped = opts.history.length - history.length;
  if (dropped > 0) ctl.onTrim?.({ dropped, kept: history.length, total: opts.history.length });

  const result: ChatMessage[] = [];
  for (const item of preset.promptOrder) {
    if (!item.enabled) continue;

    if (item.id === "history") {
      for (const msg of history) result.push({ role: msg.role, content: sub(msg.content) });
      continue;
    }

    const text = componentText(opts, item.id);
    if (!text) continue;
    // postHistory — инструкция «после истории» от лица пользователя; остальные части — system.
    const role = item.id === "postHistory" ? "user" : "system";
    result.push({ role, content: sub(text) });
  }

  result.push({ role: "user", content: sub(userMessage) });
  return result;
}

/**
 * Подставляет блочные плейсхолдеры (промпты) в шаблон impersonate, затем {{char}}/{{user}}.
 * Порядок важен: сперва вставляем тексты промптов, потом заменяем имена — чтобы {{char}}/{{user}}
 * внутри вставленных промптов тоже разрешились.
 */
function renderImpersonateTemplate(
  template: string,
  ctx: {
    charName: string;
    userName: string;
    charPrompt: string;
    userPrompt: string;
    systemPrompt: string;
    auxPrompt: string;
  },
): string {
  const withBlocks = template
    .replace(/\{\{char_prompt\}\}/gi, ctx.charPrompt)
    .replace(/\{\{user_prompt\}\}/gi, ctx.userPrompt)
    .replace(/\{\{system_prompt\}\}/gi, ctx.systemPrompt)
    .replace(/\{\{aux_prompt\}\}/gi, ctx.auxPrompt);
  return replacePlaceholders(withBlocks, ctx.charName, ctx.userName);
}

/**
 * Рендерит активный путь плоским текстом: «Имя:\n<реплика>», блоки через пустую строку.
 * Всегда заканчивается затравкой «<userName>:» — явный speaker cue для модели: история обычно
 * кончается репликой персонажа, и без затравки модель продолжила бы за {{char}} или эхнула бы
 * собственный префикс. Затравка снимает обе проблемы (ответ не в том лице / эхо префикса).
 */
function renderImpersonateHistory(
  history: MessageInPath[],
  charName: string,
  userName: string,
): string {
  const body = history
    .map((m) => {
      const name = m.role === "assistant" ? charName : userName;
      return `${name}:\n${replacePlaceholders(m.content, charName, userName)}`;
    })
    .join("\n\n");
  return body ? `${body}\n\n${userName}:` : `${userName}:`;
}

/**
 * Урезает историю impersonate под лимит контекста пресета (та же логика, что resolveHistory для
 * обычной генерации, но запрос здесь — 2 сообщения: system-шаблон + плоская история). Из бюджета
 * вычитаем резерв под ответ, токены system-сообщения и финальной затравки «userName:»; стоимость
 * каждой реплики считаем по её флэт-форме «Name:\n<content>». Без contextSize → история как есть.
 */
function resolveImpersonateHistory(
  opts: ImpersonateOptions,
  systemText: string,
  charName: string,
  userName: string,
): MessageInPath[] {
  if (opts.contextUnlimited || opts.contextSize == null) return opts.history;

  const reserve = opts.maxTokens ?? DEFAULT_OUTPUT_RESERVE;
  const fixed = countTokens(systemText) + countTokens(`${userName}:`) + 2 * PER_MESSAGE_OVERHEAD;
  const available = opts.contextSize - reserve - fixed;
  const trimmed = trimHistoryToBudget(opts.history, available, (m) => {
    const name = m.role === "assistant" ? charName : userName;
    return countTokens(`${name}:\n${replacePlaceholders(m.content, charName, userName)}`) + PER_MESSAGE_OVERHEAD;
  });

  const dropped = opts.history.length - trimmed.length;
  if (dropped > 0) opts.onTrim?.({ dropped, kept: trimmed.length, total: opts.history.length });
  return trimmed;
}

/**
 * Собирает запрос impersonate — РОВНО 2 сообщения:
 *   system — шаблон с подставленными плейсхолдерами (или дефолт),
 *   user   — плоская история активного пути (роли вынесены в текст, чтобы снять
 *            обуславливание «продолжай как {{char}}»).
 * Намеренно НЕ использует promptOrder/buildMessages, но историю урезает под contextSize так же.
 */
export function renderImpersonateMessages(opts: ImpersonateOptions): ChatMessage[] {
  const charName = opts.character.name;
  const userName = opts.persona?.name ?? "User";
  const template = opts.template.trim() || DEFAULT_IMPERSONATE_TEMPLATE;

  const system = renderImpersonateTemplate(template, {
    charName,
    userName,
    charPrompt: opts.character.prompt,
    userPrompt: opts.persona?.prompt ?? "",
    systemPrompt: opts.systemPrompt,
    auxPrompt: opts.auxPrompt,
  });
  // Сперва жёстко берём последние IMPERSONATE_HISTORY_LIMIT сообщений, затем урезаем под contextSize.
  const capped =
    opts.history.length > IMPERSONATE_HISTORY_LIMIT
      ? opts.history.slice(-IMPERSONATE_HISTORY_LIMIT)
      : opts.history;
  const history = resolveImpersonateHistory({ ...opts, history: capped }, system, charName, userName);
  const user = renderImpersonateHistory(history, charName, userName);

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/**
 * Дефолтный пресет генерации, когда у чата пресет не выбран. Значимы здесь только
 * promptOrder (что включаем в контекст) и пустые промпты; сэмплинг — дефолты провайдера.
 * Фабрика, а не константа: id/userId/createdAt привязаны к пользователю.
 */
export function makeDefaultPreset(userId: number): GenerationPreset {
  return {
    id: 0, userId, name: "default",
    contextUnlimited: false, contextSize: null, maxTokens: null, streaming: false,
    temperature: null, topP: null, topK: null,
    frequencyPenalty: null, presencePenalty: null, repetitionPenalty: null,
    minP: null, topA: null,
    systemPrompt: "", auxiliarySystemPrompt: "", postHistoryInstruction: "", userPersonaPrompt: "",
    userPersonaStreaming: true,
    translationSystemPrompt: "",
    requestReasoning: false, reasoningEffort: null,
    promptOrder: [
      { id: "system", enabled: false },
      { id: "characterDescription", enabled: true },
      { id: "userDescription", enabled: false },
      { id: "auxiliary", enabled: false },
      { id: "characterScenario", enabled: false },
      { id: "history", enabled: true },
      { id: "postHistory", enabled: false },
    ],
    createdAt: new Date(), updatedAt: new Date(),
  };
}

/**
 * Маппит поля пресета в ChatCompletionOptions (сэмплинг-параметры).
 * null-значения пропускаются — провайдер применяет свои дефолты.
 */
export function presetToCompletionOptions(preset: GenerationPreset) {
  return {
    temperature: preset.temperature ?? undefined,
    maxTokens: preset.maxTokens ?? undefined,
    topP: preset.topP ?? undefined,
    topK: preset.topK ?? undefined,
    frequencyPenalty: preset.frequencyPenalty ?? undefined,
    presencePenalty: preset.presencePenalty ?? undefined,
    repetitionPenalty: preset.repetitionPenalty ?? undefined,
    minP: preset.minP ?? undefined,
    topA: preset.topA ?? undefined,
    // Reasoning («мышление»): применяется провайдеро-специфично (для DeepSeek — thinking-режим).
    requestReasoning: preset.requestReasoning,
    reasoningEffort: preset.reasoningEffort ?? undefined,
  };
}
