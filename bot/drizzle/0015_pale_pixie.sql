CREATE TABLE "story_settings" (
	"story_chat_id" bigint PRIMARY KEY NOT NULL,
	"translate_enabled" boolean DEFAULT false NOT NULL,
	"translate_target_lang" text DEFAULT 'ru' NOT NULL,
	"translate_scope" text DEFAULT 'assistant' NOT NULL,
	"auto_translate_scope" text DEFAULT 'none' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_messages" ADD COLUMN "translations" jsonb;--> statement-breakpoint
ALTER TABLE "story_settings" ADD CONSTRAINT "story_settings_story_chat_id_story_chats_id_fk" FOREIGN KEY ("story_chat_id") REFERENCES "public"."story_chats"("id") ON DELETE cascade ON UPDATE no action;