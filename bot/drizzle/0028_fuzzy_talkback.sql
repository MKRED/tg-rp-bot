ALTER TABLE "generation_presets" DROP COLUMN "system_prompt";--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "auxiliary_system_prompt";--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "post_history_instruction";--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "user_persona_prompt";--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "user_persona_streaming";--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "translation_system_prompt";--> statement-breakpoint
ALTER TABLE "generation_presets" DROP COLUMN "prompt_order";