import { Module } from "@nestjs/common";
import { createTavilyDispatcher } from "./tavily-proxy.js";
import { TAVILY_DISPATCHER } from "./tavily.constants.js";
import { TavilyService } from "./tavily.service.js";

/**
 * Клиент Tavily (веб-поиск, квота ключа) и его прокси-диспетчер. Без зависимостей от настроек:
 * ключ передаёт вызывающий — проверка ключа в SettingsModule, поиск в генерации карточек.
 */
@Module({
  providers: [{ provide: TAVILY_DISPATCHER, useFactory: createTavilyDispatcher }, TavilyService],
  exports: [TavilyService],
})
export class TavilyModule {}
