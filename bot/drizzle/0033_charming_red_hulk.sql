ALTER TABLE "cards" ADD COLUMN "prompt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "categories" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "preset_id" bigint;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_preset_id_generation_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."generation_presets"("id") ON DELETE no action ON UPDATE no action;