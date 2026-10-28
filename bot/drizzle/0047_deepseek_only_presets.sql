ALTER TABLE "narrator_templates" ALTER COLUMN "translation_reasoning_effort" SET DEFAULT 'high';--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "top_k";--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "frequency_penalty";--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "presence_penalty";--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "repetition_penalty";--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "min_p";--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "top_a";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "deepseek_model";