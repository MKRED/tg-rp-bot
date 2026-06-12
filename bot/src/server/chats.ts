import { Hono } from "hono";
import {
  createChat,
  deleteChat,
  getChatSettings,
  getChatTree,
  getChat,
  listChats,
  upsertChatSettings,
} from "../db/chats.js";
import { getCharacter } from "../db/characters.js";
import logger from "../logger.js";
import type { AppVariables } from "./initData.js";
import {
  handleDeleteMessage,
  handleEditMessage,
  handleRegenerateMessage,
  handleSendMessage,
  handleSwitchBranch,
  handleTranslateMessage,
} from "./messageHandlers.js";

export function createChatRoutes(): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  // ─── Список / создание / детали / удаление ────────────────────────────────

  app.get("/", async (c) => {
    const userId = c.get("tgUser")!.id;
    const page = Math.max(1, Number(c.req.query("page") ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(c.req.query("pageSize") ?? 20)));
    const { items, total } = await listChats(userId, page, pageSize);
    return c.json({ items, total, page, pageSize });
  });

  app.post("/", async (c) => {
    const userId = c.get("tgUser")!.id;
    const body = (await c.req.json().catch(() => ({}))) as {
      characterId?: unknown;
      personaId?: unknown;
      presetId?: unknown;
    };

    const characterId = typeof body.characterId === "number" ? body.characterId : null;
    if (!characterId) return c.json({ error: "characterId is required" }, 400);

    const personaId = typeof body.personaId === "number" ? body.personaId : null;
    const presetId = typeof body.presetId === "number" ? body.presetId : null;

    const character = await getCharacter(userId, characterId);
    if (!character) return c.json({ error: "Character not found" }, 404);

    // firstMessages уже расшифрованы в getCharacter
    const firstMessage = character.firstMessages[0] ?? null;

    const t0 = Date.now();
    const chat = await createChat(userId, { characterId, personaId, presetId }, firstMessage);
    logger.info({ durationMs: Date.now() - t0, userId, chatId: chat.id }, "Chat created via API");
    return c.json({ chat: { id: chat.id } }, 201);
  });

  app.get("/:id", async (c) => {
    const userId = c.get("tgUser")!.id;
    const chatId = Number(c.req.param("id"));
    const chat = await getChat(userId, chatId);
    if (!chat) return c.json({ error: "Chat not found" }, 404);
    return c.json({ chat });
  });

  app.delete("/:id", async (c) => {
    const userId = c.get("tgUser")!.id;
    const chatId = Number(c.req.param("id"));
    const deleted = await deleteChat(userId, chatId);
    if (!deleted) return c.json({ error: "Chat not found" }, 404);
    return c.json({ ok: true });
  });

  // ─── Граф (дерево для React Flow) ────────────────────────────────────────

  app.get("/:id/tree", async (c) => {
    const userId = c.get("tgUser")!.id;
    const chatId = Number(c.req.param("id"));
    const nodes = await getChatTree(userId, chatId);
    if (nodes.length === 0) {
      // Может быть пустой чат (без сообщений) или несуществующий
      const chat = await getChat(userId, chatId);
      if (!chat) return c.json({ error: "Chat not found" }, 404);
    }
    return c.json({ nodes });
  });

  // ─── Настройки чата ───────────────────────────────────────────────────────

  app.get("/:id/settings", async (c) => {
    const userId = c.get("tgUser")!.id;
    const chatId = Number(c.req.param("id"));
    // Проверяем принадлежность
    const chat = await getChat(userId, chatId);
    if (!chat) return c.json({ error: "Chat not found" }, 404);
    const settings = await getChatSettings(chatId);
    return c.json({ settings });
  });

  app.put("/:id/settings", async (c) => {
    const userId = c.get("tgUser")!.id;
    const chatId = Number(c.req.param("id"));

    const chat = await getChat(userId, chatId);
    if (!chat) return c.json({ error: "Chat not found" }, 404);

    const body = (await c.req.json().catch(() => ({}))) as {
      translateEnabled?: unknown;
      translateTargetLang?: unknown;
      translateScope?: unknown;
    };

    const patch: Record<string, unknown> = {};
    if (typeof body.translateEnabled === "boolean") patch.translateEnabled = body.translateEnabled;
    if (typeof body.translateTargetLang === "string") patch.translateTargetLang = body.translateTargetLang;
    if (["all", "assistant", "user"].includes(body.translateScope as string)) {
      patch.translateScope = body.translateScope;
    }

    const settings = await upsertChatSettings(chatId, patch);
    return c.json({ settings });
  });

  // ─── Сообщения (делегируем в messageHandlers) ─────────────────────────────

  app.post("/:id/messages", handleSendMessage);
  app.delete("/:id/messages/:msgId", handleDeleteMessage);
  app.post("/:id/messages/:msgId/edit", handleEditMessage);
  app.post("/:id/messages/:msgId/regenerate", handleRegenerateMessage);
  app.post("/:id/messages/:msgId/branch", handleSwitchBranch);
  app.post("/:id/messages/:msgId/translate", handleTranslateMessage);

  return app;
}
