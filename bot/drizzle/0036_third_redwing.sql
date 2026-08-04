ALTER TABLE "cards" ADD COLUMN "use_web_search" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "tavily_max_search_rounds" integer DEFAULT 4 NOT NULL;