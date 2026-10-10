import { Injectable } from "@nestjs/common";
import type { ChatStats } from "@tg-rp-bot/shared";
import { buildMessages, DEFAULT_RP_PROMPT_ORDER } from "../../prompt/promptBuilder/index.js";
import type { GenerationPreset } from "../../db/schema.js";
import { countTokens } from "../../utils/index.js";
import { ChatContextService } from "../chat-context.service.js";
import { ImpersonationsRepository } from "../impersonations/impersonations.repository.js";
import { ChatStatsRepository } from "./chat-stats.repository.js";

/**
 * Знаменатель полосы загрузки контекста: окно пресета; безграничный контекст, незаданный размер или
 * нет пресета → null (полоса покажет «∞»).
 */
export function contextLimitOf(preset: Pick<GenerationPreset, "contextUnlimited" | "contextSize"> | null): number | null {
  return preset?.contextUnlimited ? null : (preset?.contextSize ?? null);
}

/** Статистика чата для экрана настроек (токены, лимит контекста, число вариантов impersonate). */
@Injectable()
export class ChatStatsService {
  constructor(
    private readonly access: ChatContextService,
    private readonly stats: ChatStatsRepository,
    private readonly impersonations: ImpersonationsRepository,
  ) {}

  /**
   *   tokensTotal / tokensActiveBranch — токены сообщений всех веток / активной ветки;
   *   tokensPrompt — полный запрос к LLM по активной ветке, ровно как его собирает buildMessages;
   *   contextLimit — окно контекста пресета (null — безграничный/не задан);
   *   impersonationCount — число сохранённых вариантов реплик игрока.
   */
  async get(userId: string, chatId: number): Promise<ChatStats> {
    const { chat, character, persona, template, preset } = await this.access.requireContext(userId, chatId);

    // userMessage пуст: текущий объём без ещё не введённой реплики. trim:false — намеренно НЕ урезаем:
    // бар должен показать «желаемый» объём, чтобы было видно переполнение окна (used > limit →
    // красный), хотя сама генерация историю урежет.
    const promptMessages = buildMessages(
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
        userMessage: "",
      },
      { trim: false },
    );
    // Только токены контента: служебные ~4 токена/сообщение (PER_MESSAGE_OVERHEAD) — деталь учёта
    // бюджета обрезки, пользователю не показываем.
    const tokensPrompt = promptMessages.reduce((sum, m) => sum + countTokens(m.content), 0);
    const contextLimit = contextLimitOf(preset);

    const [tokens, impersonationCount] = await Promise.all([
      this.stats.tokenStats(userId, chatId, chat.activeMessageId),
      this.impersonations.countForChat(chatId),
    ]);
    return { ...tokens, tokensPrompt, contextLimit, impersonationCount };
  }
}
