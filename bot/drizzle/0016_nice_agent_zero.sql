CREATE TABLE "user_settings" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"llm_debug_enabled" boolean DEFAULT true NOT NULL,
	"llm_debug_max_requests" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;