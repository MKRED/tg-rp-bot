/**
 * Таблицы с данными пользователей: как найти владельца строки (его ключ) и чем адресовать строку
 * при обновлении. Колонки не перечислены — скрипт обходит все text/text[]/jsonb колонки таблицы
 * (см. reencrypt-value.ts). Таблица, забытая здесь, не пройдёт финальную проверку «нет v1».
 */
export interface TableSpec {
  table: string;
  /** Колонка-адрес строки для UPDATE. */
  rowKey: string;
  /** SQL-выражение владельца (users.id) для строки с алиасом t. */
  owner: string;
}

const byUser = (table: string, rowKey = "id"): TableSpec => ({ table, rowKey, owner: "t.user_id" });
const viaChat = (table: string, rowKey = "id"): TableSpec => ({
  table,
  rowKey,
  owner: "(SELECT c.user_id FROM chats c WHERE c.id = t.chat_id)",
});
const viaStory = (table: string, rowKey = "id"): TableSpec => ({
  table,
  rowKey,
  owner: "(SELECT s.user_id FROM story_chats s WHERE s.id = t.story_chat_id)",
});

export const TABLES: TableSpec[] = [
  byUser("user_settings", "user_id"),
  byUser("characters"),
  byUser("personas"),
  byUser("cards"),
  byUser("generation_presets"),
  byUser("rp_templates"),
  byUser("narrator_templates"),
  byUser("knowledge_books"),
  byUser("chats"),
  byUser("story_chats"),
  viaChat("messages"),
  viaChat("impersonation_variants"),
  viaChat("chat_settings", "chat_id"),
  viaStory("story_messages"),
  viaStory("story_compactions"),
  viaStory("story_settings", "story_chat_id"),
  {
    table: "knowledge_book_entries",
    rowKey: "id",
    owner: "(SELECT b.user_id FROM knowledge_books b WHERE b.id = t.book_id)",
  },
];
