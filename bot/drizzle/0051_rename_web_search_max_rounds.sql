-- Имя колонки осталось от Tavily (прежнего провайдера поиска) — приводим к полю webSearchMaxRounds.
ALTER TABLE "user_settings" RENAME COLUMN "tavily_max_search_rounds" TO "web_search_max_rounds";
