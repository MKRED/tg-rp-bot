import { Hono } from "hono";
import {
  createChat,
  deleteChat,
  renameChat,
  getChatSettings,
  getChatTree,
  getChat,
  listChats,
  upsertChatSettings,
} from "../../db/chats/index.js";
import { getCharacter } from "../../db/characters/index.js";
import { getPersona } from "../../db/personas/index.js";
import { getPreset } from "../../db/presets/index.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import {
  handleDeleteMessage,
  handleDeleteTranslation,
  handleEditMessage,
  handleRegenerateMessage,
  handleSendMessage,
  handleSwitchBranch,
  handleTranslateMessage,
} from "./messages.handlers.js";
import {
  handleClearImpersonations,
  handleDeleteImpersonation,
  handleImpersonate,
  handleListImpersonations,
  handleTranslateText,
} from "./impersonate.handlers.js";
import { handleChatStats } from "./stats.handler.js";

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
      firstMessageIndex?: unknown;
    };

    const characterId = typeof body.characterId === "number" ? body.characterId : null;
    if (characterId === null) return c.json({ error: "characterId is required" }, 400);

    // Персона и пресет обязательны (NOT NULL в схеме) — играть без персоны нельзя
    const personaId = typeof body.personaId === "number" ? body.personaId : null;
    if (personaId === null) return c.json({ error: "personaId is required" }, 400);

    const presetId = typeof body.presetId === "number" ? body.presetId : null;
    if (presetId === null) return c.json({ error: "presetId is required" }, 400);

    // Все три сущности должны принадлежать пользователю (DAO user-scoped → undefined для чужих)
    const character = await getCharacter(userId, characterId);
    if (!character) return c.json({ error: "Character not found" }, 404);

    const persona = await getPersona(userId, personaId);
    if (!persona) return c.json({ error: "Persona not found" }, 404);

    const preset = await getPreset(userId, presetId);
    if (!preset) return c.json({ error: "Preset not found" }, 404);

    // Выбранное приветствие (firstMessages уже расшифрованы в getCharacter). Индекс с защитой границ:
    // нет приветствий или индекс вне диапазона → null (чат стартует пустым).
    const idx = typeof body.firstMessageIndex === "number" ? body.firstMessageIndex : 0;
    const firstMessage = character.firstMessages[idx] ?? null;

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

  app.patch("/:id", async (c) => {
    const userId = c.get("tgUser")!.id;
    const chatId = Number(c.req.param("id"));
    const body = (await c.req.json().catch(() => ({}))) as { title?: unknown };

    if (typeof body.title !== "string") {
      return c.json({ error: "title must be a string" }, 400);
    }
    // Ограничиваем длину названия, чтобы не раздувать список/шапку
    const title = body.title.slice(0, 100);

    const result = await renameChat(userId, chatId, title);
    if (!result) return c.json({ error: "Chat not found" }, 404);
    return c.json({ title: result.title });
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

  // ─── Статистика чата (для экрана настроек) ────────────────────────────────

  app.get("/:id/stats", handleChatStats);

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
      autoTranslateScope?: unknown;
      translateMethod?: unknown;
    };

    const patch: Record<string, unknown> = {};
    if (typeof body.translateEnabled === "boolean") patch.translateEnabled = body.translateEnabled;
    if (typeof body.translateTargetLang === "string") patch.translateTargetLang = body.translateTargetLang;
    if (["all", "assistant", "user"].includes(body.translateScope as string)) {
      patch.translateScope = body.translateScope;
    }
    if (["none", "all", "assistant", "user"].includes(body.autoTranslateScope as string)) {
      patch.autoTranslateScope = body.autoTranslateScope;
    }
    if (["google", "ai"].includes(body.translateMethod as string)) {
      patch.translateMethod = body.translateMethod;
    }

    const settings = await upsertChatSettings(chatId, patch);
    return c.json({ settings });
  });

  // ─── Сообщения (делегируем в messages.handlers) ───────────────────────────

  app.post("/:id/messages", handleSendMessage);
  app.delete("/:id/messages/:msgId", handleDeleteMessage);
  app.post("/:id/messages/:msgId/edit", handleEditMessage);
  app.post("/:id/messages/:msgId/regenerate", handleRegenerateMessage);
  app.post("/:id/messages/:msgId/branch", handleSwitchBranch);
  app.post("/:id/messages/:msgId/translate", handleTranslateMessage);
  app.delete("/:id/messages/:msgId/translate", handleDeleteTranslation);

  // ─── Impersonate (генерация реплики от лица пользователя) ──────────────────
  // Регистрируем вне ветки /:id/messages/:msgId, чтобы не конфликтовать с :msgId.
  app.get("/:id/impersonate", handleListImpersonations);
  app.post("/:id/impersonate", handleImpersonate);
  app.delete("/:id/impersonate", handleClearImpersonations);
  app.delete("/:id/impersonate/:variantId", handleDeleteImpersonation);
  app.post("/:id/translate-text", handleTranslateText);

  return app;
}
