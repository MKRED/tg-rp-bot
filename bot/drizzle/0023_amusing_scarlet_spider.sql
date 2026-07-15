CREATE TABLE "rp_templates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rp_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"name" text NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"auxiliary_system_prompt" text DEFAULT '' NOT NULL,
	"post_history_instruction" text DEFAULT '' NOT NULL,
	"user_persona_prompt" text DEFAULT '' NOT NULL,
	"user_persona_streaming" boolean DEFAULT true NOT NULL,
	"translation_system_prompt" text DEFAULT '' NOT NULL,
	"prompt_order" jsonb DEFAULT '[{"id":"system","enabled":true},{"id":"characterDescription","enabled":true},{"id":"userDescription","enabled":false},{"id":"auxiliary","enabled":true},{"id":"characterScenario","enabled":false},{"id":"history","enabled":true},{"id":"postHistory","enabled":true}]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rp_templates" ADD CONSTRAINT "rp_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Бэкофилл: RP-шаблон на КАЖДЫЙ существующий generation_presets (не только используемые чатами —
-- иначе их промпты будут потеряны, когда отдельная более поздняя миграция удалит эти колонки из
-- generation_presets). legacy_preset_id — временная колонка только для маппинга
-- «старый пресет → новый RP-шаблон» внутри этой миграции, дропается ниже same statement-batch.
ALTER TABLE "rp_templates" ADD COLUMN "legacy_preset_id" bigint;
--> statement-breakpoint
INSERT INTO "rp_templates" (
	"user_id", "name", "system_prompt", "auxiliary_system_prompt", "post_history_instruction",
	"user_persona_prompt", "user_persona_streaming", "translation_system_prompt", "prompt_order",
	"legacy_preset_id"
)
SELECT
	"user_id", "name", "system_prompt", "auxiliary_system_prompt", "post_history_instruction",
	"user_persona_prompt", "user_persona_streaming", "translation_system_prompt", "prompt_order",
	"id"
FROM "generation_presets" gp
WHERE NOT EXISTS (
	SELECT 1 FROM "rp_templates" rt WHERE rt."legacy_preset_id" = gp."id"
);
--> statement-breakpoint

ALTER TABLE "chats" ADD COLUMN "template_id" bigint;
--> statement-breakpoint
UPDATE "chats" c SET "template_id" = rt."id"
FROM "rp_templates" rt
WHERE rt."legacy_preset_id" = c."preset_id" AND c."template_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "rp_templates" DROP COLUMN "legacy_preset_id";
--> statement-breakpoint

ALTER TABLE "chats" ALTER COLUMN "template_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_template_id_rp_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."rp_templates"("id") ON DELETE no action ON UPDATE no action;
