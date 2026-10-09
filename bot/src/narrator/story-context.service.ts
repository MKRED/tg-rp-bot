import { Injectable, NotFoundException } from "@nestjs/common";
import { EntriesPromptRepository } from "../knowledge-books/entries/entries-prompt.repository.js";
import { NarratorTemplatesRepository } from "../narrator-templates/narrator-templates.repository.js";
import { PresetsRepository } from "../presets/presets.repository.js";
import { CompactionsRepository } from "./compaction/compactions.repository.js";
import { compactComponentOn, type StoryContext, storyPromptOrder } from "./generation/story-completion.js";
import { StoryMessagesRepository, type StoryMessageRow } from "./messages/story-messages.repository.js";
import { StorySettingsRepository } from "./settings/story-settings.repository.js";
import { StoriesRepository, type StoryRow } from "./stories/stories.repository.js";

export const STORY_NOT_FOUND = "Story not found";
export const MESSAGE_NOT_FOUND = "Message not found";

/**
 * Доступ к истории с проверкой владельца: лёгкая строка (принадлежность, курсор), сообщение этой
 * истории или полный контекст для сборки запроса к LLM.
 */
@Injectable()
export class StoryContextService {
  constructor(
    private readonly stories: StoriesRepository,
    private readonly messages: StoryMessagesRepository,
    private readonly settings: StorySettingsRepository,
    private readonly compactions: CompactionsRepository,
    private readonly templates: NarratorTemplatesRepository,
    private readonly presets: PresetsRepository,
    private readonly entries: EntriesPromptRepository,
  ) {}

  /** Строка истории пользователя без сообщений; чужая/несуществующая — 404 Story not found. */
  async requireRow(userId: number, storyId: number): Promise<StoryRow> {
    const row = await this.stories.findRow(userId, storyId);
    if (!row) throw new NotFoundException(STORY_NOT_FOUND);
    return row;
  }

  /**
   * Сообщение этой истории пользователя. Сначала владелец истории (404 Story not found), потом
   * сообщение (404 Message not found): сам по себе id сообщения владельца не проверяет.
   */
  async requireMessage(userId: number, storyId: number, messageId: number): Promise<{ story: StoryRow; msg: StoryMessageRow }> {
    const story = await this.requireRow(userId, storyId);
    const msg = await this.messages.findOne(userId, storyId, messageId);
    if (!msg) throw new NotFoundException(MESSAGE_NOT_FOUND);
    return { story, msg };
  }

  /**
   * История с активным путём + шаблон, пресет, настройки, записи книги и пересказы. Пересказы
   * читаем, только если сжатие включено и в шаблоне, и в настройках — иначе они не применяются.
   */
  async requireContext(userId: number, storyId: number): Promise<StoryContext> {
    const story = await this.stories.findDetail(userId, storyId);
    if (!story) throw new NotFoundException(STORY_NOT_FOUND);
    const [template, preset, settings, entries] = await Promise.all([
      story.template ? this.templates.findOne(userId, story.template.id) : undefined,
      story.preset ? this.presets.findOne(userId, story.preset.id) : undefined,
      this.settings.get(storyId),
      this.entries.findActive(userId, story.book.id),
    ]);
    const compactOn = compactComponentOn(storyPromptOrder(template ?? null)) && settings.compactEnabled;
    const compactions = compactOn && story.activeMessageId != null ? await this.compactions.list(userId, storyId) : [];
    return { story, template: template ?? null, preset: preset ?? null, settings, compactions, entries };
  }
}
