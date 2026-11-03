CREATE TABLE "coauthor_chats" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coauthor_chats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"card_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preset_id" bigint,
	"system_prompt" text DEFAULT '' NOT NULL,
	"use_ask_user" boolean DEFAULT true NOT NULL,
	"use_web_search" boolean DEFAULT false NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coauthor_chats" ADD CONSTRAINT "coauthor_chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coauthor_chats" ADD CONSTRAINT "coauthor_chats_preset_id_generation_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."generation_presets"("id") ON DELETE no action ON UPDATE no action;