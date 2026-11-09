CREATE TABLE "image_canvas_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "image_canvas_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"canvas_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"image" text NOT NULL,
	"thumb" text,
	"prompt" text DEFAULT '' NOT NULL,
	"model" text NOT NULL,
	"seed" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_canvases" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "image_canvases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"model" text DEFAULT 'qwen' NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reference_thumbs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gen_status" text DEFAULT 'idle' NOT NULL,
	"gen_prompt_id" text,
	"gen_started_at" timestamp with time zone,
	"gen_error" text,
	"gen_request" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_canvas_items" ADD CONSTRAINT "image_canvas_items_canvas_id_image_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."image_canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_canvas_items" ADD CONSTRAINT "image_canvas_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_canvases" ADD CONSTRAINT "image_canvases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_canvas_items_canvas_idx" ON "image_canvas_items" USING btree ("canvas_id","kind");