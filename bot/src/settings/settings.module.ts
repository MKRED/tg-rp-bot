import { Module } from "@nestjs/common";
import { LlmSettingsController } from "./llm/llm-settings.controller.js";
import { LlmSettingsRepository } from "./llm/llm-settings.repository.js";
import { LlmSettingsService } from "./llm/llm-settings.service.js";
import { TavilySettingsController } from "./tavily/tavily-settings.controller.js";
import { TavilySettingsRepository } from "./tavily/tavily-settings.repository.js";
import { TavilySettingsService } from "./tavily/tavily-settings.service.js";
import { TranslateSettingsController } from "./translate/translate-settings.controller.js";
import { TranslateSettingsRepository } from "./translate/translate-settings.repository.js";
import { TranslateSettingsService } from "./translate/translate-settings.service.js";

/**
 * /api/settings — персональные настройки пользователя (все в строке user_settings): ключ/модель
 * DeepSeek, ключ Tavily, режим перевода. Каждая подсущность — свой контроллер/сервис/репозиторий:
 * у них разная форма данных и разные внешние API проверки ключа.
 */
@Module({
  controllers: [LlmSettingsController, TavilySettingsController, TranslateSettingsController],
  providers: [
    LlmSettingsService,
    LlmSettingsRepository,
    TavilySettingsService,
    TavilySettingsRepository,
    TranslateSettingsService,
    TranslateSettingsRepository,
  ],
  // Генерации карточек нужен ключ Tavily и лимит раундов поиска.
  exports: [TavilySettingsRepository],
})
export class SettingsModule {}
