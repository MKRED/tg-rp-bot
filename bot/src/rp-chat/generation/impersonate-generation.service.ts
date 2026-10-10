import { Injectable, type MessageEvent } from "@nestjs/common";
import { SSE_EVENTS } from "@tg-rp-bot/shared";
import type { Observable } from "rxjs";
import { sseObservable } from "../../common/sse-observable.js";
import { streamCompletion, writeEvent, writeGenerationError } from "../../common/stream-completion.js";
import { LlmService } from "../../llm/llm.service.js";
import logger from "../../logger.js";
import { ChatContextService } from "../chat-context.service.js";
import { ImpersonationsRepository } from "../impersonations/impersonations.repository.js";
import { buildImpersonateCompletion } from "./rp-completion.js";

/**
 * Генерация варианта реплики от лица игрока (impersonate). Готовый вариант сохраняется для текущего
 * момента диалога (момент = курсор чата; FIFO-лимит вариантов на момент — в репозитории).
 */
@Injectable()
export class ImpersonateGenerationService {
  constructor(
    private readonly access: ChatContextService,
    private readonly impersonations: ImpersonationsRepository,
    private readonly llm: LlmService,
  ) {}

  async generate(userId: string, chatId: number): Promise<Observable<MessageEvent>> {
    const ctx = await this.access.requireContext(userId, chatId);
    const { messages, sampling, doStream } = buildImpersonateCompletion(ctx, ({ dropped, kept, total }) =>
      logger.info({ userId, chatId, dropped, kept, total }, "Impersonate history trimmed to context budget"),
    );
    const parentMessageId = ctx.chat.activeMessageId;

    return sseObservable("impersonate", async (sink) => {
      try {
        const t0 = Date.now();
        const result = await streamCompletion(this.llm, sink, { messages, ...sampling, userId, debugLabel: "impersonate" }, doStream);
        const variant = await this.impersonations.insert(userId, chatId, parentMessageId, result.content);
        logger.info({ durationMs: Date.now() - t0, userId, chatId, streamed: doStream }, "Impersonate variant generated");
        await writeEvent(sink, SSE_EVENTS.done, { variant });
      } catch (err) {
        logger.error({ err, userId, chatId }, "impersonate stream error");
        await writeGenerationError(sink, err);
      }
    });
  }
}
