import {
  buildMessages,
  DEFAULT_RP_PROMPT_ORDER,
  presetToCompletionOptions,
  renderImpersonateMessages,
  type TrimInfo,
} from "../../prompt/promptBuilder/index.js";
import type { ChatContext } from "../chat-context.service.js";

/**
 * Запрос RP-ответа по контексту чата: промпты и их порядок — из RP-шаблона, лимиты контекста и
 * сэмплинг — из пресета. Отсутствие шаблона/пресета (защитный fallback, оба NOT NULL) не валит
 * генерацию. history — активный путь чата; userMessage добавляется в конец отдельно, поэтому курсор
 * должен стоять ПЕРЕД репликой игрока (иначе она попала бы в запрос дважды).
 */
export function buildRpCompletion(ctx: ChatContext, userMessage: string, onTrim?: (info: TrimInfo) => void) {
  const { chat, character, persona, template, preset } = ctx;
  const messages = buildMessages(
    {
      systemPrompt: template?.systemPrompt ?? "",
      auxiliarySystemPrompt: template?.auxiliarySystemPrompt ?? "",
      postHistoryInstruction: template?.postHistoryInstruction ?? "",
      promptOrder: template?.promptOrder ?? DEFAULT_RP_PROMPT_ORDER,
      contextUnlimited: preset?.contextUnlimited,
      contextSize: preset?.contextSize,
      maxTokens: preset?.maxTokens,
      character: { name: character.name, prompt: character.prompt, scenario: character.scenario },
      persona: persona ? { name: persona.name, prompt: persona.prompt } : null,
      history: chat.messages,
      userMessage,
    },
    { onTrim },
  );
  return { messages, sampling: preset ? presetToCompletionOptions(preset) : {} };
}

/**
 * Запрос варианта реплики от лица игрока: 2 сообщения (system-шаблон + плоская история). Стриминг
 * токенов — по флагу RP-шаблона userPersonaStreaming (выкл → клиент покажет спиннер).
 */
export function buildImpersonateCompletion(ctx: ChatContext, onTrim?: (info: TrimInfo) => void) {
  const { chat, character, persona, template, preset } = ctx;
  const messages = renderImpersonateMessages({
    template: template?.userPersonaPrompt ?? "",
    character: { name: character.name, prompt: character.prompt, scenario: character.scenario },
    persona: persona ? { name: persona.name, prompt: persona.prompt } : null,
    systemPrompt: template?.systemPrompt ?? "",
    auxPrompt: template?.auxiliarySystemPrompt ?? "",
    history: chat.messages,
    // Лимит контекста урезает историю так же, как в обычной генерации.
    contextUnlimited: preset?.contextUnlimited,
    contextSize: preset?.contextSize,
    maxTokens: preset?.maxTokens,
    onTrim,
  });
  return {
    messages,
    sampling: preset ? presetToCompletionOptions(preset) : {},
    doStream: template?.userPersonaStreaming ?? true,
  };
}
