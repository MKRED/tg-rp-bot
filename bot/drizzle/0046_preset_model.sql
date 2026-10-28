ALTER TABLE "generation_presets" ADD COLUMN "model" text;--> statement-breakpoint
-- Модель переезжает из настроек пользователя в пресет: каждый пресет получает модель, выбранную сейчас в настройках.
UPDATE "generation_presets" AS p SET "model" = s."deepseek_model" FROM "user_settings" AS s WHERE s."user_id" = p."user_id" AND s."deepseek_model" IS NOT NULL;--> statement-breakpoint
-- Уровни рассуждения сужены до тех, что принимает DeepSeek (low|high|max) — тот же маппинг, что делал mapEffort.
UPDATE "generation_presets" SET "reasoning_effort" = CASE "reasoning_effort" WHEN 'minimal' THEN 'low' WHEN 'ultra' THEN 'max' ELSE 'high' END WHERE "reasoning_effort" IN ('minimal', 'medium', 'xhigh', 'ultra');--> statement-breakpoint
UPDATE "narrator_templates" SET "translation_reasoning_effort" = CASE "translation_reasoning_effort" WHEN 'minimal' THEN 'low' WHEN 'ultra' THEN 'max' ELSE 'high' END WHERE "translation_reasoning_effort" IN ('minimal', 'medium', 'xhigh', 'ultra');--> statement-breakpoint
UPDATE "user_settings" SET "prompt_translate_reasoning_effort" = CASE "prompt_translate_reasoning_effort" WHEN 'minimal' THEN 'low' WHEN 'ultra' THEN 'max' ELSE 'high' END WHERE "prompt_translate_reasoning_effort" IN ('minimal', 'medium', 'xhigh', 'ultra');
