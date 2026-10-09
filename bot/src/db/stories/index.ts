import { DatabaseService } from "../../database/database.service.js";
import { EntriesPromptRepository } from "../../knowledge-books/entries/entries-prompt.repository.js";
import { NarratorTemplatesRepository } from "../../narrator-templates/narrator-templates.repository.js";
import { CompactionsRepository } from "../../narrator/compaction/compactions.repository.js";
import { CompactionsService } from "../../narrator/compaction/compactions.service.js";
import { StoryMessagesRepository } from "../../narrator/messages/story-messages.repository.js";
import { StorySettingsRepository } from "../../narrator/settings/story-settings.repository.js";
import { StoriesRepository } from "../../narrator/stories/stories.repository.js";
import { StoryContextService } from "../../narrator/story-context.service.js";
import { StoryPathRepository } from "../../narrator/story-path.repository.js";
import { PresetsRepository } from "../../presets/presets.repository.js";

/**
 * ВРЕМЕННЫЙ мост для legacy Hono-маршрутов историй (advance, регенерация, ручное сжатие): те же
 * репозитории и сервисы, что в Nest (NarratorModule), собранные вручную. Удаляется, когда эти
 * маршруты переедут на Nest (шаг P3).
 */
const database = new DatabaseService();
const path = new StoryPathRepository(database);
const compactions = new CompactionsRepository(database);
const stories = new StoriesRepository(database, path);
const messages = new StoryMessagesRepository(database, path, compactions);
const settings = new StorySettingsRepository(database);
const context = new StoryContextService(
  stories,
  messages,
  settings,
  compactions,
  new NarratorTemplatesRepository(database),
  new PresetsRepository(database),
  new EntriesPromptRepository(database),
);
const compactionsService = new CompactionsService(compactions, stories, context);

export type { CompactionRow as StoryCompactionRow } from "../../narrator/compaction/compactions.repository.js";

/** История с активным путём (undefined — нет у пользователя). */
export const getStory = (userId: number, storyId: number) => stories.findDetail(userId, storyId);

/** Сообщение этой истории (историю проверяет вызывающий). */
export const getStoryMessage = (userId: number, storyId: number, messageId: number) => messages.findOne(userId, storyId, messageId);

export const insertStoryMessage = messages.insert.bind(messages);

/** Курсор ровно на узел, без спуска к листу. */
export const setActiveStoryMessage = (storyId: number, messageId: number | null) => messages.setCursor(storyId, messageId);

/** Курсор на лист под узлом. */
export const updateActiveStoryMessage = (storyId: number, messageId: number) => messages.moveCursorToLeaf(storyId, messageId);

export const deleteStoryMessage = (userId: number, storyId: number, messageId: number) =>
  messages.removeSubtree(userId, storyId, messageId);

export const getStorySettings = (storyId: number) => settings.get(storyId);

export const listCompactions = (userId: number, storyId: number) => compactions.list(userId, storyId);
export const nextCompactionSeq = (storyId: number) => compactions.nextSeq(storyId);
export const insertCompaction = compactions.insert.bind(compactions);

/** Валидная цепочка пересказов активной ветки в виде для webapp. */
export const listActiveCompactions = (userId: number, storyId: number) => compactionsService.listActive(userId, storyId);

/** Контекст для сборки запроса к LLM; нет истории — NotFoundException. */
export const loadStoryContext = (userId: number, storyId: number) => context.requireContext(userId, storyId);
