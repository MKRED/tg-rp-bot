import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { CreateStoryDto } from "./dto/create-story.dto.js";
import { ListStoriesQueryDto } from "./dto/list-stories-query.dto.js";
import { UpdateStoryDto } from "./dto/update-story.dto.js";
import { StoriesService } from "./stories.service.js";

/** /api/stories — список, создание, история с активным путём, правка, удаление, граф веток. */
@Controller("stories")
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Get()
  async list(@CurrentUser() userId: number, @Query() { page, pageSize }: ListStoriesQueryDto) {
    const { items, total } = await this.stories.list(userId, page, pageSize);
    return { items, total, page, pageSize };
  }

  @Post()
  async create(@CurrentUser() userId: number, @Body() input: CreateStoryDto) {
    const story = await this.stories.create(userId, input);
    return { story: { id: story.id } };
  }

  @Get(":id")
  async get(@CurrentUser() userId: number, @Param("id", ParseIntPipe) storyId: number) {
    return { story: await this.stories.get(userId, storyId) };
  }

  @Patch(":id")
  update(@CurrentUser() userId: number, @Param("id", ParseIntPipe) storyId: number, @Body() input: UpdateStoryDto) {
    return this.stories.update(userId, storyId, input);
  }

  @Delete(":id")
  async remove(@CurrentUser() userId: number, @Param("id", ParseIntPipe) storyId: number) {
    await this.stories.remove(userId, storyId);
    return { ok: true };
  }

  @Get(":id/tree")
  async tree(@CurrentUser() userId: number, @Param("id", ParseIntPipe) storyId: number) {
    return { nodes: await this.stories.tree(userId, storyId) };
  }
}
