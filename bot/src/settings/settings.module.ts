import { Module } from "@nestjs/common";
import { LlmSettingsController } from "./llm/llm-settings.controller.js";
import { LlmSettingsRepository } from "./llm/llm-settings.repository.js";
import { LlmSettingsService } from "./llm/llm-settings.service.js";
import { TranslateSettingsController } from "./translate/translate-settings.controller.js";
import { TranslateSettingsRepository } from "./translate/translate-settings.repository.js";
import { TranslateSettingsService } from "./translate/translate-settings.service.js";
import { WebSearchSettingsController } from "./web-search/web-search-settings.controller.js";
import { WebSearchSettingsRepository } from "./web-search/web-search-settings.repository.js";

/**
 * /api/settings — персональные настройки пользователя (все в строке user_settings): ключ DeepSeek,
 * лимит раундов веб-поиска, режим перевода. Каждая подсущность — свой контроллер/репозиторий:
 * у них разная форма данных и разные внешние API проверки ключа.
 */
@Module({
  controllers: [LlmSettingsController, WebSearchSettingsController, TranslateSettingsController],
  providers: [
    LlmSettingsService,
    LlmSettingsRepository,
    WebSearchSettingsRepository,
    TranslateSettingsService,
    TranslateSettingsRepository,
  ],
  // Вызову LLM (LlmModule) и веб-поиску генерации карточек нужен ключ DeepSeek, генерации карточек —
  // ещё лимит раундов поиска, переводу — промпт-шаблон и effort.
  exports: [LlmSettingsRepository, WebSearchSettingsRepository, TranslateSettingsRepository],
})
export class SettingsModule {}
