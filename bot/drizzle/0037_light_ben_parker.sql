ALTER TABLE "user_settings" ADD COLUMN "prompt_translate_engine" text DEFAULT 'google' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "prompt_translate_target_lang" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "prompt_translate_system_prompt" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "prompt_translate_reasoning_effort" text DEFAULT 'off' NOT NULL;