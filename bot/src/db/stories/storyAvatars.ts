import { sql } from "drizzle-orm";

/** Дескриптор аватара в стеке истории — источник записи книги знаний (персонаж или персона). */
export type StoryAvatarRef = {
  type: "character" | "persona";
  id: number;
  name: string;
  hasImage: boolean;
};

/**
 * LATERAL-фрагмент: топ-`limit` дескрипторов аватаров книги (алиас `b`, ожидается в объемлющем
 * запросе — как у `knowledge_books b`) по sort_order ВКЛЮЧЁННЫХ записей с привязанным character/
 * persona (свободнотекстовые записи в стек не идут — им нечего показать; выключенные — не участвуют
 * в промпте, поэтому и в аватарках истории их быть не должно). json_agg схлопывает N строк
 * в один массив на книгу, поэтому фрагмент — обычный LEFT JOIN LATERAL, а не подзапрос в SELECT.
 */
export function bookAvatarsLateral(limit: number) {
  return sql`
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
        'type', CASE WHEN sub.character_id IS NOT NULL THEN 'character' ELSE 'persona' END,
        'id', COALESCE(sub.character_id, sub.persona_id),
        'name', COALESCE(sub.char_name, sub.persona_name),
        'hasImage', COALESCE(sub.char_has_image, sub.persona_has_image)
      ) ORDER BY sub.sort_order, sub.created_at) AS avatars
      FROM (
        SELECT e.character_id, e.persona_id, e.sort_order, e.created_at,
          ch.name AS char_name, ch.image IS NOT NULL AS char_has_image,
          pe.name AS persona_name, pe.image IS NOT NULL AS persona_has_image
        FROM knowledge_book_entries e
        LEFT JOIN characters ch ON ch.id = e.character_id
        LEFT JOIN personas pe ON pe.id = e.persona_id
        WHERE e.book_id = b.id AND e.enabled = TRUE
          AND (e.character_id IS NOT NULL OR e.persona_id IS NOT NULL)
        ORDER BY e.sort_order ASC, e.created_at ASC
        LIMIT ${limit}
      ) sub
    ) av ON TRUE
  `;
}

/** Достаёт массив дескрипторов из сырой колонки av.avatars (json_agg отдаёт null на пустой книге). */
export function mapStoryAvatars(raw: unknown): StoryAvatarRef[] {
  return (raw as StoryAvatarRef[] | null) ?? [];
}
