import type { Context } from "hono";
import type { getCharacter } from "../../db/characters/index.js";
import type { getChat } from "../../db/chats/index.js";
import type { getPersona } from "../../db/personas/index.js";
import type { getPreset } from "../../db/presets/index.js";
import type { AppVariables } from "../middleware/initData.types.js";

/** Контекст Hono RP-роутов (после requireInitData). */
export type Ctx = Context<{ Variables: AppVariables }>;

/**
 * Чат + связанные сущности (персонаж/персона/пресет) с проверкой владельца. Переиспользуется
 * обычной генерацией, impersonate-хендлерами и статистикой (см. loadChatContext).
 */
export type ChatContext = {
  chat: NonNullable<Awaited<ReturnType<typeof getChat>>>;
  character: NonNullable<Awaited<ReturnType<typeof getCharacter>>>;
  persona: Awaited<ReturnType<typeof getPersona>> | null;
  preset: Awaited<ReturnType<typeof getPreset>> | null;
};
