import { Injectable } from "@nestjs/common";
import type { StoryStats } from "@tg-rp-bot/shared";
import { countTokens } from "../../utils/index.js";
import { compactUnavailableReason } from "../compaction/compact-gate.js";
import { buildStoryCompletion } from "../generation/story-completion.js";
import { StoryContextService } from "../story-context.service.js";
import { StoryStatsRepository } from "./story-stats.repository.js";

/** Статистика истории для экрана настроек: токены, лимит контекста, доступность сжатия. */
@Injectable()
export class StoryStatsService {
  constructor(
    private readonly access: StoryContextService,
    private readonly stats: StoryStatsRepository,
  ) {}

  /**
   *   tokensTotal / tokensActiveBranch — токены сообщений всех веток / активной ветки;
   *   tokensPrompt — полный запрос к LLM по активной ветке, ровно как его собирает buildStoryMessages;
   *   contextLimit — окно контекста пресета (null — безграничный/не задан);
   *   compactAvailable/compactReason — гейт секции сжатия: нужен и лимит пресета, и компонент шаблона.
   */
  async get(userId: string, storyId: number): Promise<StoryStats> {
    const ctx = await this.access.requireContext(userId, storyId);
    // trim:false — намеренно НЕ урезаем историю: бар показывает «желаемый» объём, чтобы было видно
    // переполнение окна (used > limit → красный), хотя сама генерация историю урежет.
    const { msgs, compactComponentEnabled } = buildStoryCompletion(ctx, { trim: false });
    // Только токены контента: служебный overhead на сообщение — деталь бюджета обрезки.
    const tokensPrompt = msgs.reduce((sum, m) => sum + countTokens(m.content), 0);
    const { preset } = ctx;
    const contextLimit = preset?.contextUnlimited ? null : (preset?.contextSize ?? null);

    const reason = compactUnavailableReason(preset);
    const tokens = await this.stats.tokenStats(userId, storyId, ctx.story.activeMessageId);
    return {
      ...tokens,
      tokensPrompt,
      contextLimit,
      compactAvailable: reason === null && compactComponentEnabled,
      // Пресет подходит, но компонент выключен в шаблоне — причина в шаблоне.
      compactReason: reason === null && !compactComponentEnabled ? "template_off" : reason,
      templateCompactEnabled: compactComponentEnabled,
    };
  }
}
