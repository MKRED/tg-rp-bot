ALTER TABLE "story_chats" DROP CONSTRAINT "story_chats_template_id_narrator_templates_id_fk";
--> statement-breakpoint
ALTER TABLE "story_chats" DROP CONSTRAINT "story_chats_preset_id_generation_presets_id_fk";
--> statement-breakpoint
ALTER TABLE "story_chats" ALTER COLUMN "template_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "story_chats" ALTER COLUMN "preset_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "story_chats" ADD CONSTRAINT "story_chats_template_id_narrator_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."narrator_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_chats" ADD CONSTRAINT "story_chats_preset_id_generation_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."generation_presets"("id") ON DELETE no action ON UPDATE no action;