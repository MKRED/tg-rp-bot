import { Hono } from "hono";
import type { AppVariables } from "../middleware/initData.types.js";
import { handleAdvanceStory } from "./advance.handler.js";
import { handleCompactStory } from "./compact.handler.js";
import { handleRegenerateStoryBeat } from "./messages.handler.js";

/**
 * Остаток /api/stories в legacy Hono: стриминговые advance и регенерация бита и ручное сжатие (его
 * блокировка общая с авто-сжатием внутри advance). Остальное — NarratorModule в Nest; сюда запросы
 * доходят только через LEGACY_ROUTES моста (legacyBridge.ts).
 */
export function createStoryRoutes(): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();
  app.post("/:id/compact", handleCompactStory);
  app.post("/:id/advance", handleAdvanceStory);
  app.post("/:id/messages/:msgId/regenerate", handleRegenerateStoryBeat);
  return app;
}
