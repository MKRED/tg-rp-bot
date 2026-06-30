CREATE TABLE "story_compactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "story_compactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"story_chat_id" bigint NOT NULL,
	"seq" integer NOT NULL,
	"from_anchor_id" bigint,
	"to_anchor_id" bigint NOT NULL,
	"summary" text NOT NULL,
	"covered_count" integer DEFAULT 0 NOT NULL,
	"covered_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "narrator_templates" ALTER COLUMN "prompt_order" SET DEFAULT '[{"id":"system","enabled":true},{"id":"lorebook","enabled":true},{"id":"auxiliary","enabled":true},{"id":"premise","enabled":true},{"id":"compact","enabled":true},{"id":"history","enabled":true},{"id":"postHistory","enabled":false}]'::jsonb;--> statement-breakpoint
ALTER TABLE "narrator_templates" ADD COLUMN "compaction_prompt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "story_settings" ADD COLUMN "compact_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "story_settings" ADD COLUMN "compact_auto_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "story_settings" ADD COLUMN "compact_floor_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "story_settings" ADD COLUMN "compact_words" integer DEFAULT 200 NOT NULL;--> statement-breakpoint
ALTER TABLE "story_compactions" ADD CONSTRAINT "story_compactions_story_chat_id_story_chats_id_fk" FOREIGN KEY ("story_chat_id") REFERENCES "public"."story_chats"("id") ON DELETE cascade ON UPDATE no action;