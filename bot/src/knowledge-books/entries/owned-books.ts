import { sql } from "drizzle-orm";

/** Подзапрос «книги этого пользователя» — для проверки владения записью без явного join. */
export function ownedBooks(userId: number) {
  return sql`(SELECT id FROM knowledge_books WHERE user_id = ${userId})`;
}
