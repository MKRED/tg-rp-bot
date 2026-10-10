import { Injectable, NotFoundException } from "@nestjs/common";
import type { StoryCompaction } from "@tg-rp-bot/shared";
import logger from "../../logger.js";
import { StoriesRepository } from "../stories/stories.repository.js";
import { STORY_NOT_FOUND, StoryContextService } from "../story-context.service.js";
import { CompactionsRepository } from "./compactions.repository.js";
import { splitByCompactions } from "./live-tail.js";

/** Пересказы активной ветки истории: список для настроек и удаление каскадом вперёд. */
@Injectable()
export class CompactionsService {
  constructor(
    private readonly compactions: CompactionsRepository,
    private readonly stories: StoriesRepository,
    private readonly access: StoryContextService,
  ) {}

  /** Валидная цепочка пересказов активной ветки (без якорей — они внутренние). */
  async listActive(userId: string, storyId: number): Promise<StoryCompaction[]> {
    const story = await this.stories.findDetail(userId, storyId);
    if (!story) throw new NotFoundException(STORY_NOT_FOUND);
    if (story.activeMessageId == null) return [];
    const { chain } = splitByCompactions(story.messages, await this.compactions.list(userId, storyId));
    return chain.map(({ id, seq, summary, coveredCount, coveredTokens }) => ({ id, seq, summary, coveredCount, coveredTokens }));
  }

  /** Удаляет пересказ и все последующие; сжатые ими сообщения возвращаются в живую историю. */
  async remove(userId: string, storyId: number, compactionId: number): Promise<StoryCompaction[]> {
    await this.access.requireRow(userId, storyId);
    if (!(await this.compactions.removeCascade(storyId, compactionId))) throw new NotFoundException("Compaction not found");
    logger.info({ userId, storyId, compactionId }, "Story compaction deleted via API");
    return this.listActive(userId, storyId);
  }
}
