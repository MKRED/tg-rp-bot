import { Module } from "@nestjs/common";
import { KnowledgeBooksModule } from "../knowledge-books/knowledge-books.module.js";
import { NarratorTemplatesModule } from "../narrator-templates/narrator-templates.module.js";
import { PresetsModule } from "../presets/presets.module.js";
import { CompactionsController } from "./compaction/compactions.controller.js";
import { CompactionsRepository } from "./compaction/compactions.repository.js";
import { CompactionsService } from "./compaction/compactions.service.js";
import { StoryMessagesController } from "./messages/story-messages.controller.js";
import { StoryMessagesRepository } from "./messages/story-messages.repository.js";
import { StoryMessagesService } from "./messages/story-messages.service.js";
import { StorySettingsController } from "./settings/story-settings.controller.js";
import { StorySettingsRepository } from "./settings/story-settings.repository.js";
import { StorySettingsService } from "./settings/story-settings.service.js";
import { StoryStatsController } from "./stats/story-stats.controller.js";
import { StoryStatsRepository } from "./stats/story-stats.repository.js";
import { StoryStatsService } from "./stats/story-stats.service.js";
import { StoriesController } from "./stories/stories.controller.js";
import { StoriesRepository } from "./stories/stories.repository.js";
import { StoriesService } from "./stories/stories.service.js";
import { StoryContextService } from "./story-context.service.js";
import { StoryPathRepository } from "./story-path.repository.js";
import { StoryTranslationController } from "./translation/story-translation.controller.js";
import { StoryTranslationService } from "./translation/story-translation.service.js";

/**
 * /api/stories — истории narrator («Режиссёр истории»): истории, сообщения дерева, перевод,
 * настройки, статистика, пересказы. Книга знаний, narrator-шаблон и пресет — репозитории соседних
 * модулей через DI. Стриминговые advance/регенерация и ручное сжатие пока в legacy Hono.
 */
@Module({
  imports: [KnowledgeBooksModule, NarratorTemplatesModule, PresetsModule],
  controllers: [
    StoriesController,
    StoryMessagesController,
    StoryTranslationController,
    StorySettingsController,
    StoryStatsController,
    CompactionsController,
  ],
  providers: [
    StoryContextService,
    StoryPathRepository,
    StoriesService,
    StoriesRepository,
    StoryMessagesService,
    StoryMessagesRepository,
    StoryTranslationService,
    StorySettingsService,
    StorySettingsRepository,
    StoryStatsService,
    StoryStatsRepository,
    CompactionsService,
    CompactionsRepository,
  ],
})
export class NarratorModule {}
