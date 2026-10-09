import { Hono } from "hono";
import type { AppVariables } from "../middleware/initData.types.js";
import { handleImpersonate } from "./impersonate.handlers.js";
import { handleEditMessage, handleRegenerateMessage, handleSendMessage } from "./messages.handlers.js";

/**
 * ВРЕМЕННО: стриминговая генерация RP-чата (SSE). Остальные маршруты /api/chats обслуживает Nest
 * (rp-chat/); сюда мост пускает только эти четыре POST (LEGACY_ROUTES в legacyBridge.ts).
 * Переезжает на Nest @Sse следующим шагом.
 */
export function createChatRoutes(): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();
  app.post("/:id/messages", handleSendMessage);
  app.post("/:id/messages/:msgId/edit", handleEditMessage);
  app.post("/:id/messages/:msgId/regenerate", handleRegenerateMessage);
  app.post("/:id/impersonate", handleImpersonate);
  return app;
}
