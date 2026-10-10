import { Injectable, type MessageEvent, NotFoundException } from "@nestjs/common";
import { SSE_EVENTS } from "@tg-rp-bot/shared";
import type { Observable } from "rxjs";
import { sseObservable } from "../../common/sse-observable.js";
import { type SseSink, streamCompletion, writeEvent, writeGenerationError } from "../../common/stream-completion.js";
import { LlmService } from "../../llm/llm.service.js";
import logger from "../../logger.js";
import type { TrimInfo } from "../../prompt/promptBuilder/index.js";
import { type ChatContext, ChatContextService } from "../chat-context.service.js";
import { MessagesRepository } from "../messages/messages.repository.js";
import { buildRpCompletion } from "./rp-completion.js";

type RpCompletion = ReturnType<typeof buildRpCompletion>;

/**
 * Стриминговая генерация ответа ИИ в RP-чате: отправка, правка, перегенерация. Проверки (404) и
 * подготовка контекста — ДО возврата потока, поэтому ошибки уходят обычным JSON. Ошибка генерации —
 * событием error в потоке.
 *
 * Инвариант контекста: курсор перед сборкой запроса стоит на сообщении ПЕРЕД репликой игрока, а сама
 * реплика идёт отдельным userMessage — иначе history закончилась бы на ней и buildMessages добавил бы
 * её повторно. При сбое подготовки или генерации курсор возвращается: при правке — на новую реплику,
 * при перегенерации — туда, где стоял. Откат во время генерации живёт внутри потока (run стартует
 * при подписке Nest на Observable).
 */
@Injectable()
export class ChatGenerationService {
  constructor(
    private readonly access: ChatContextService,
    private readonly messages: MessagesRepository,
    private readonly llm: LlmService,
  ) {}

  /** Новая реплика игрока в конец активной ветки + ответ ИИ. */
  async send(userId: string, chatId: number, content: string): Promise<Observable<MessageEvent>> {
    const ctx = await this.access.requireContext(userId, chatId);
    const completion = this.completion(userId, chatId, ctx, content);
    const parentId = ctx.chat.activeMessageId;
    return sseObservable("rp send", async (sink) => {
      try {
        const userMsg = await this.messages.insert(userId, chatId, parentId, "user", content);
        await writeEvent(sink, SSE_EVENTS.userMessage, userMsg);
        await this.reply(sink, userId, chatId, userMsg.id, completion);
      } catch (err) {
        logger.error({ err, userId, chatId }, "sendMessage stream error");
        await writeGenerationError(sink, err);
      }
    });
  }

  /**
   * Правка = новый сиблинг. Ответ ИИ правится без генерации (поток только с done); реплика игрока —
   * новый user-сиблинг и заново сгенерированный ответ на него.
   */
  async edit(userId: string, chatId: number, msgId: number, content: string): Promise<Observable<MessageEvent>> {
    const { chat, msg: original } = await this.access.requireMessage(userId, chatId, msgId);

    if (original.role === "assistant") {
      const edited = await this.messages.insert(userId, chatId, original.parentId, "assistant", content);
      await this.messages.moveCursorToLeaf(chatId, edited.id);
      // Клиент ждёт event:done и для этого случая, не JSON.
      return sseObservable("rp edit", async (sink) => void (await writeEvent(sink, SSE_EVENTS.done, edited)));
    }

    // Реплику вставляем после сборки запроса: если чат/персонаж не нашёлся — без сиротского сиблинга.
    const completion = await this.prepare(userId, chatId, original.parentId, content, chat.activeMessageId);
    const userMsg = await this.messages.insert(userId, chatId, original.parentId, "user", content);
    return sseObservable("rp edit", async (sink) => {
      try {
        await writeEvent(sink, SSE_EVENTS.userMessage, userMsg);
        await this.reply(sink, userId, chatId, userMsg.id, completion);
      } catch (err) {
        logger.error({ err, userId, chatId }, "editMessage stream error");
        // Курсор — на новую реплику (выше неё поднимали только ради контекста).
        await this.restoreCursor(chatId, userMsg.id);
        await writeGenerationError(sink, err);
      }
    });
  }

  /**
   * Новый ответ ИИ: на assistant-сообщение — перегенерация (отвечаем на его родительскую реплику),
   * на user-сообщение — первый ответ на неё.
   */
  async regenerate(userId: string, chatId: number, msgId: number): Promise<Observable<MessageEvent>> {
    const { chat, msg: original } = await this.access.requireMessage(userId, chatId, msgId);
    const userMsg =
      original.role === "user"
        ? original
        : original.parentId
          ? await this.messages.findOne(userId, chatId, original.parentId)
          : undefined;
    if (!userMsg) throw new NotFoundException("Parent user message not found");

    const completion = await this.prepare(userId, chatId, userMsg.parentId, userMsg.content, chat.activeMessageId);
    return sseObservable("rp regenerate", async (sink) => {
      try {
        await this.reply(sink, userId, chatId, userMsg.id, completion);
      } catch (err) {
        logger.error({ err, userId, chatId }, "regenerate stream error");
        // Курсор — туда, где стоял (обычно прежний ответ), а не к точке до реплики.
        await this.restoreCursor(chatId, chat.activeMessageId);
        await writeGenerationError(sink, err);
      }
    });
  }

  /** Генерирует ответ на реплику parentId, сохраняет его, ставит курсор и пишет done. */
  private async reply(sink: SseSink, userId: string, chatId: number, parentId: number, completion: RpCompletion): Promise<void> {
    const t0 = Date.now();
    const result = await streamCompletion(this.llm, sink, { messages: completion.messages, ...completion.sampling, userId, debugLabel: "rp" });
    const reply = await this.messages.insert(userId, chatId, parentId, "assistant", result.content);
    await this.messages.moveCursorToLeaf(chatId, reply.id);
    logger.info({ durationMs: Date.now() - t0, userId, chatId, messageId: reply.id }, "RP reply generated");
    await writeEvent(sink, SSE_EVENTS.done, reply);
  }

  private completion(userId: string, chatId: number, ctx: ChatContext, userMessage: string): RpCompletion {
    // История урезана под contextSize пресета — фиксируем, сколько старых реплик выпало.
    const onTrim = ({ dropped, kept, total }: TrimInfo) =>
      logger.info({ userId, chatId, dropped, kept, total }, "History trimmed to context budget");
    return buildRpCompletion(ctx, userMessage, onTrim);
  }

  /**
   * Запрос для ответа на реплику, стоящую под узлом above: курсор поднимается на above (история —
   * без старого ответа и без самой реплики), контекст и запрос собираются. Любой сбой подготовки —
   * курсор возвращается на прежнее место (previous) и ошибка уходит наружу (404 JSON). Дальше откат
   * живёт внутри потока.
   */
  private async prepare(
    userId: string,
    chatId: number,
    above: number | null,
    userMessage: string,
    previous: number | null,
  ): Promise<RpCompletion> {
    await this.messages.setCursor(chatId, above);
    try {
      const ctx = await this.access.requireContext(userId, chatId);
      return this.completion(userId, chatId, ctx, userMessage);
    } catch (err) {
      await this.restoreCursor(chatId, previous);
      throw err;
    }
  }

  /** Курсор ровно на узел (без спуска к листу); сбой отката — лог, а не потеря исходной ошибки. */
  private async restoreCursor(chatId: number, messageId: number | null): Promise<void> {
    await this.messages
      .setCursor(chatId, messageId)
      .catch((err: unknown) => logger.warn({ err, chatId, messageId }, "Failed to restore chat cursor"));
  }
}
