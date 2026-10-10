-- Написано вручную (drizzle-kit сгенерировал ALTER TYPE bigint → uuid, который не сохраняет данные).
-- users.id: Telegram id → собственный UUID; старый id остаётся в users.telegram_id.
-- data_key добавляется nullable: ключи пользователей генерирует и NOT NULL ставит скрипт
-- src/scripts/migrate-user-keys (нужен мастер-ключ из env, в SQL его нет). До его успешного
-- прогона бот запускать нельзя.

ALTER TABLE "users" ADD COLUMN "telegram_id" bigint;--> statement-breakpoint
UPDATE "users" SET "telegram_id" = "id";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "new_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "data_key" text;--> statement-breakpoint

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cards', 'characters', 'chats', 'generation_presets', 'knowledge_books',
    'narrator_templates', 'personas', 'rp_templates', 'story_chats', 'user_settings'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN user_uuid uuid', t);
    EXECUTE format('UPDATE %I x SET user_uuid = u.new_id FROM users u WHERE u.id = x.user_id', t);
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, t || '_user_id_users_id_fk');
    -- DROP COLUMN снимает и PK user_settings (он на user_id)
    EXECUTE format('ALTER TABLE %I DROP COLUMN user_id', t);
    EXECUTE format('ALTER TABLE %I RENAME COLUMN user_uuid TO user_id', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN user_id SET NOT NULL', t);
  END LOOP;
END $$;--> statement-breakpoint

ALTER TABLE "users" DROP CONSTRAINT "users_pkey";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "users" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id");--> statement-breakpoint
ALTER TABLE "user_settings" ADD PRIMARY KEY ("user_id");--> statement-breakpoint

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cards', 'characters', 'chats', 'generation_presets', 'knowledge_books',
    'narrator_templates', 'personas', 'rp_templates', 'story_chats', 'user_settings'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      t, t || '_user_id_users_id_fk'
    );
  END LOOP;
END $$;
