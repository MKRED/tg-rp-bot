import { Module } from "@nestjs/common";
import { CharactersModule } from "../characters/characters.module.js";
import { PersonasModule } from "../personas/personas.module.js";
import { PresetsModule } from "../presets/presets.module.js";
import { RpTemplatesModule } from "../rp-templates/rp-templates.module.js";
import { ChatContextService } from "./chat-context.service.js";
import { ChatPathRepository } from "./chat-path.repository.js";
import { ChatsController } from "./chats/chats.controller.js";
import { ChatsRepository } from "./chats/chats.repository.js";
import { ChatsService } from "./chats/chats.service.js";
import { ImpersonationsController } from "./impersonations/impersonations.controller.js";
import { ImpersonationsRepository } from "./impersonations/impersonations.repository.js";
import { ImpersonationsService } from "./impersonations/impersonations.service.js";
import { MessagesController } from "./messages/messages.controller.js";
import { MessagesRepository } from "./messages/messages.repository.js";
import { MessagesService } from "./messages/messages.service.js";
import { ChatSettingsController } from "./settings/chat-settings.controller.js";
import { ChatSettingsRepository } from "./settings/chat-settings.repository.js";
import { ChatSettingsService } from "./settings/chat-settings.service.js";
import { ChatStatsController } from "./stats/chat-stats.controller.js";
import { ChatStatsRepository } from "./stats/chat-stats.repository.js";
import { ChatStatsService } from "./stats/chat-stats.service.js";
import { ChatTranslationController } from "./translation/chat-translation.controller.js";
import { ChatTranslationService } from "./translation/chat-translation.service.js";

/**
 * /api/chats — RP-чаты: чаты, сообщения дерева, перевод, настройки, статистика, варианты impersonate.
 * Персонаж, персона, RP-шаблон и пресет чата — репозитории соседних модулей через DI.
 */
@Module({
  imports: [CharactersModule, PersonasModule, RpTemplatesModule, PresetsModule],
  controllers: [
    ChatsController,
    MessagesController,
    ChatTranslationController,
    ChatSettingsController,
    ChatStatsController,
    ImpersonationsController,
  ],
  providers: [
    ChatContextService,
    ChatPathRepository,
    ChatsService,
    ChatsRepository,
    MessagesService,
    MessagesRepository,
    ChatTranslationService,
    ChatSettingsService,
    ChatSettingsRepository,
    ChatStatsService,
    ChatStatsRepository,
    ImpersonationsService,
    ImpersonationsRepository,
  ],
})
export class RpChatModule {}
