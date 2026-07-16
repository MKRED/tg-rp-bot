import { and, eq, inArray } from "drizzle-orm";
import logger from "../../logger.js";
import { db, schema } from "../index.js";
import type { AvatarBatchRef, AvatarBatchResult } from "./types.js";

/**
 * Батч-резолв аватаров для AvatarStack (список историй / шапка чата): один запрос вместо
 * поштучной догрузки на каждый дескриптор. Владение проверяется по user_id — чужие/несуществующие
 * id молча выпадают из ответа (не 403 на каждый), запись без картинки тоже не попадает в результат.
 */
export async function getAvatarsBatch(
  userId: number,
  refs: AvatarBatchRef[],
): Promise<AvatarBatchResult[]> {
  const t0 = Date.now();
  const characterIds = refs.filter((r) => r.type === "character").map((r) => r.id);
  const personaIds = refs.filter((r) => r.type === "persona").map((r) => r.id);

  const results: AvatarBatchResult[] = [];

  if (characterIds.length > 0) {
    const rows = await db
      .select({ id: schema.characters.id, image: schema.characters.image })
      .from(schema.characters)
      .where(and(inArray(schema.characters.id, characterIds), eq(schema.characters.userId, userId)));
    for (const row of rows) {
      if (row.image) results.push({ type: "character", id: row.id, dataUrl: row.image });
    }
  }

  if (personaIds.length > 0) {
    const rows = await db
      .select({ id: schema.personas.id, image: schema.personas.image })
      .from(schema.personas)
      .where(and(inArray(schema.personas.id, personaIds), eq(schema.personas.userId, userId)));
    for (const row of rows) {
      if (row.image) results.push({ type: "persona", id: row.id, dataUrl: row.image });
    }
  }

  logger.debug(
    { durationMs: Date.now() - t0, userId, requested: refs.length, resolved: results.length },
    "Avatars batch resolved",
  );
  return results;
}
