CREATE TABLE "knowledge_book_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "knowledge_book_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"book_id" bigint NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"activation" text DEFAULT 'always_on' NOT NULL,
	"character_id" bigint,
	"content" text DEFAULT '' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_books" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "knowledge_books_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "narrator_templates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "narrator_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"name" text NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"post_history_instruction" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_chats" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "story_chats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"book_id" bigint NOT NULL,
	"template_id" bigint,
	"preset_id" bigint,
	"title" text,
	"opening_beat" text NOT NULL,
	"premise" text DEFAULT '' NOT NULL,
	"active_message_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "story_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"story_chat_id" bigint NOT NULL,
	"parent_id" bigint,
	"role" text NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_book_entries" ADD CONSTRAINT "knowledge_book_entries_book_id_knowledge_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."knowledge_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_book_entries" ADD CONSTRAINT "knowledge_book_entries_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_books" ADD CONSTRAINT "knowledge_books_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrator_templates" ADD CONSTRAINT "narrator_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_chats" ADD CONSTRAINT "story_chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_chats" ADD CONSTRAINT "story_chats_book_id_knowledge_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."knowledge_books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_chats" ADD CONSTRAINT "story_chats_template_id_narrator_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."narrator_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_chats" ADD CONSTRAINT "story_chats_preset_id_generation_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."generation_presets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_messages" ADD CONSTRAINT "story_messages_story_chat_id_story_chats_id_fk" FOREIGN KEY ("story_chat_id") REFERENCES "public"."story_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_messages" ADD CONSTRAINT "story_messages_parent_id_story_messages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."story_messages"("id") ON DELETE cascade ON UPDATE no action;