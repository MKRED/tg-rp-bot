import { Module } from "@nestjs/common";
import { WebSearchService } from "./web-search.service.js";

/**
 * Клиент веб-поиска DeepSeek. Без зависимостей от настроек: ключ передаёт вызывающий — генерация
 * карточек берёт ключ DeepSeek пользователя из того же репозитория, что и LlmService.
 */
@Module({
  providers: [WebSearchService],
  exports: [WebSearchService],
})
export class WebSearchModule {}
