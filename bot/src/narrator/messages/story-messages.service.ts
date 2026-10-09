import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { EditStoryBeatResponse } from "@tg-rp-bot/shared";
import logger from "../../logger.js";
import { StoryPathRepository } from "../story-path.repository.js";
import { MESSAGE_NOT_FOUND, StoryContextService } from "../story-context.service.js";
import { StoryMessagesRepository } from "./story-messages.repository.js";

/** Сообщения истории вне генерации: переключение ветки, правка бита, удаление поддерева. */
@Injectable()
export class StoryMessagesService {
  constructor(
    private readonly messages: StoryMessagesRepository,
    private readonly path: StoryPathRepository,
    private readonly access: StoryContextService,
  ) {}

  /**
   * По биту курсор встаёт ровно на узел (можно ответвиться отсюда, как в RP-графе). По user-ходу
   * (директива/«Дальше») — нельзя: это эфемерный триггер, история обязана заканчиваться битом.
   * Встаём на ЕГО бит (самый свежий прямой ребёнок; строгое чередование бит↔ход), а не спускаемся к
   * самому глубокому листу — иначе клик в середине графа увёл бы в конец истории. Висячий ход без
   * бита (середина генерации) — откат на родительский бит.
   */
  async switchBranch(userId: number, storyId: number, messageId: number): Promise<void> {
    const { msg } = await this.access.requireMessage(userId, storyId, messageId);
    const target = msg.kind === "beat" ? messageId : ((await this.path.newestChild(storyId, messageId)) ?? msg.parentId);
    await this.messages.setCursor(storyId, target);
  }

  /** Правит текст бита на месте (любого, включая открытие): без ИИ и нового сиблинга. Директивы — 400. */
  async editBeat(userId: number, storyId: number, messageId: number, content: string): Promise<EditStoryBeatResponse> {
    const { msg } = await this.access.requireMessage(userId, storyId, messageId);
    if (msg.role !== "assistant" || msg.kind !== "beat") throw new BadRequestException("Can only edit a beat");
    const updated = await this.messages.updateContent(userId, storyId, messageId, content);
    if (!updated) throw new NotFoundException(MESSAGE_NOT_FOUND);
    logger.info({ userId, storyId, msgId: messageId }, "Story beat edited via API");
    return { content: updated.content, translations: updated.translations };
  }

  /** Удаляет сообщение с поддеревом; открытие (корень) удалять нельзя — история без него пуста. */
  async remove(userId: number, storyId: number, messageId: number): Promise<void> {
    const { msg } = await this.access.requireMessage(userId, storyId, messageId);
    if (msg.parentId == null) throw new BadRequestException("Cannot delete the opening beat");
    const t0 = Date.now();
    if (!(await this.messages.removeSubtree(userId, storyId, messageId))) throw new NotFoundException(MESSAGE_NOT_FOUND);
    logger.info({ durationMs: Date.now() - t0, userId, storyId, msgId: messageId }, "Story message deleted via API");
  }
}
