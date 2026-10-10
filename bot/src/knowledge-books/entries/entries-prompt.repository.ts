import { Injectable } from "@nestjs/common";
import type { EntryActivation } from "@tg-rp-bot/shared";
import { sql } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import logger from "../../logger.js";
import { decryptField } from "../../utils/index.js";
import { ownedBooks } from "./owned-books.js";
import { UserKeysService } from "../../user-keys/user-keys.service.js";

/**
 * Запись, готовая к подстановке в промпт. Для записи-персонажа text собирается из карточки, для
 * свободной — из content. activation решает, включать ли always_on (фильтрует сборщик промпта).
 */
export type PromptEntry = {
  activation: EntryActivation;
  keywords: string[];
  keywordDepth: number;
  /** Готовый текст для системного блока (имя записи в LLM НЕ уходит). */
  text: string;
};

/**
 * Резолв плейсхолдеров для narrator-промпта: {{char}} → имя персонажа, {{user}} → имя персоны;
 * недостающая сторона (в narrator-режиме нет ни закреплённого персонажа, ни отыгрываемой персоны)
 * закрывается alias, заданным вручную при выборе персонажа/персоны в записи книги. Пустой alias
 * (записи без соответствующего плейсхолдера в промпте) просто вырезает токен. Регистронезависимо,
 * как replacePlaceholders в RP.
 */
function subPlaceholders(text: string, charName: string, userName: string): string {
  return text.replace(/\{\{char\}\}/gi, charName).replace(/\{\{user\}\}/gi, userName);
}

/** Записи книги для промпта истории: тексты собираются из карточек/персон/content и расшифровываются. */
@Injectable()
export class EntriesPromptRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly keys: UserKeysService,
  ) {}

  /**
   * Включённые записи книги, готовые к подстановке в промпт. Для записи-персонажа/персоны текст
   * собирается из карточки/персоны (описание, расшифрованное), для свободной — из content. Приоритет
   * веток: персонаж → персона → свободный текст (ровно одна должна быть заполнена, гарантирует
   * EntryInputDto). Итог оборачивается в блок <имя записи>…</имя записи> — так LLM видит, к
   * какому факту/персонажу/персоне относится текст, и записи не сливаются в промпте друг с другом.
   * Фильтрацию по activation (always_on vs keyword) делает сборщик промпта.
   */
  async findActive(
    userId: string,
    bookId: number,
  ): Promise<PromptEntry[]> {
    const t0 = Date.now();
    const rows = await this.database.db.execute(sql`
      SELECT
        e.name, e.activation, e.content, e.keywords, e.keyword_depth, e.character_id, e.persona_id, e.alias,
        ch.name AS char_name, ch.prompt AS char_prompt,
        pe.name AS persona_name, pe.prompt AS persona_prompt
      FROM knowledge_book_entries e
      LEFT JOIN characters ch ON ch.id = e.character_id
      LEFT JOIN personas pe ON pe.id = e.persona_id
      WHERE e.book_id = ${bookId}
        AND e.book_id IN ${ownedBooks(userId)}
        AND e.enabled = true
      ORDER BY e.sort_order ASC, e.created_at ASC
    `);
    const key = await this.keys.forUser(userId);
    logger.debug(
      { durationMs: Date.now() - t0, userId, bookId, count: (rows as unknown[]).length },
      "Active book entries loaded for prompt",
    );

    return (rows as Record<string, unknown>[]).map((r) => {
      const activation = r.activation as EntryActivation;
      const keywords = ((r.keywords as string[] | null) ?? []).map((k) => decryptField(k, key));
      const entryName = decryptField(r.name as string, key);
      const alias = decryptField(r.alias as string, key);

      let body: string;
      if (r.character_id != null && r.char_name != null) {
        // Запись-персонаж: в промпт идёт только описание из карточки (prompt зашифрован как у character).
        // Имя не дублируем — его несёт оборачивающий тег <name>; сценарий карточки в книгу знаний не тянем.
        body = subPlaceholders(decryptField((r.char_prompt as string | null) ?? "", key), r.char_name as string, alias);
      } else if (r.persona_id != null && r.persona_name != null) {
        // Запись-персона: симметрично записи-персонажу, {{char}} закрывается alias.
        body = subPlaceholders(
          decryptField((r.persona_prompt as string | null) ?? "", key),
          alias,
          r.persona_name as string,
        );
      } else {
        body = decryptField((r.content as string | null) ?? "", key);
      }
      const text = `<${entryName}>\n${body}\n</${entryName}>`;
      return { activation, keywords, keywordDepth: r.keyword_depth as number, text };
    });
  }
}
