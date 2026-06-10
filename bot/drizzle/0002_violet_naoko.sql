CREATE TABLE "generation_presets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "generation_presets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"name" text NOT NULL,
	"context_unlimited" boolean DEFAULT false NOT NULL,
	"context_size" integer,
	"max_tokens" integer,
	"streaming" boolean DEFAULT false NOT NULL,
	"temperature" real,
	"top_p" real,
	"top_k" integer,
	"frequency_penalty" real,
	"presence_penalty" real,
	"repetition_penalty" real,
	"min_p" real,
	"top_a" real,
	"system_prompt" text DEFAULT '' NOT NULL,
	"auxiliary_system_prompt" text DEFAULT '' NOT NULL,
	"post_history_instruction" text DEFAULT '' NOT NULL,
	"user_persona_prompt" text DEFAULT '' NOT NULL,
	"request_reasoning" boolean DEFAULT false NOT NULL,
	"reasoning_effort" text,
	"prompt_order" jsonb DEFAULT '[{"id":"system","enabled":true},{"id":"characterDescription","enabled":true},{"id":"userDescription","enabled":false},{"id":"auxiliary","enabled":true},{"id":"history","enabled":true},{"id":"postHistory","enabled":true}]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_presets" ADD CONSTRAINT "generation_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;