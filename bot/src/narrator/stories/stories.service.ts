import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateStoryRequest, StoryDetail, StoryListItem, StoryTreeNode, UpdateStoryRequest } from "@tg-rp-bot/shared";
import type { StoryChat } from "../../db/schema.js";
import { BooksRepository } from "../../knowledge-books/books/books.repository.js";
import { NarratorTemplatesRepository } from "../../narrator-templates/narrator-templates.repository.js";
import { PresetsRepository } from "../../presets/presets.repository.js";
import { CompactionsRepository } from "../compaction/compactions.repository.js";
import { STORY_NOT_FOUND, StoryContextService } from "../story-context.service.js";
import { StoriesRepository } from "./stories.repository.js";

/** Истории пользователя: список, создание из своих сущностей, правка названия/премизы, удаление, граф. */
@Injectable()
export class StoriesService {
  constructor(
    private readonly stories: StoriesRepository,
    private readonly access: StoryContextService,
    private readonly compactions: CompactionsRepository,
    private readonly books: BooksRepository,
    private readonly templates: NarratorTemplatesRepository,
    private readonly presets: PresetsRepository,
  ) {}

  list(userId: string, page: number, pageSize: number): Promise<{ items: StoryListItem[]; total: number }> {
    return this.stories.list(userId, page, pageSize);
  }

  /** Книга, шаблон и пресет должны принадлежать пользователю; 404 — на первом не найденном. */
  async create(userId: string, input: CreateStoryRequest): Promise<StoryChat> {
    const { bookId, templateId, presetId, openingBeat, premise } = input;
    if (!(await this.books.findOne(userId, bookId))) throw new NotFoundException("Book not found");
    if (!(await this.templates.findOne(userId, templateId))) throw new NotFoundException("Template not found");
    if (!(await this.presets.findOne(userId, presetId))) throw new NotFoundException("Preset not found");
    return this.stories.create(userId, { bookId, templateId, presetId }, openingBeat, premise);
  }

  async get(userId: string, storyId: number): Promise<StoryDetail> {
    const story = await this.stories.findDetail(userId, storyId);
    if (!story) throw new NotFoundException(STORY_NOT_FOUND);
    return story;
  }

  /** Одно поле за запрос: title (приоритетнее) либо premise — ответ содержит только применённое. */
  async update(userId: string, storyId: number, input: UpdateStoryRequest): Promise<{ title: string | null } | { premise: string }> {
    const result =
      input.title !== undefined
        ? await this.stories.rename(userId, storyId, input.title)
        : await this.stories.updatePremise(userId, storyId, input.premise ?? "");
    if (!result) throw new NotFoundException(STORY_NOT_FOUND);
    return result;
  }

  async remove(userId: string, storyId: number): Promise<void> {
    if (!(await this.stories.remove(userId, storyId))) throw new NotFoundException(STORY_NOT_FOUND);
  }

  async tree(userId: string, storyId: number): Promise<StoryTreeNode[]> {
    const story = await this.access.requireRow(userId, storyId);
    return this.stories.tree(userId, story, await this.compactions.anchors(storyId));
  }
}
