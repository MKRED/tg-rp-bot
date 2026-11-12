ALTER TABLE "coauthor_chats" ADD COLUMN "max_rounds" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "coauthor_chats" ADD COLUMN "max_edits" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "coauthor_chats" ADD COLUMN "max_questions" integer DEFAULT 2 NOT NULL;