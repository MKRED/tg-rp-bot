import { apiFetch, getApiBase, getAuthHeader } from "../../../shared/api/client";
import type {
  ChatCreated,
  ChatDetail,
  ChatInput,
  ChatListItem,
  ChatSettings,
  MessageInPath,
  TreeNode,
} from "../types/chat";

// ─── Список чатов ──────────────────────────────────────────────────────────────

export async function listRecentChats(limit = 5): Promise<ChatListItem[]> {
  try {
    const res = await apiFetch<{ items: ChatListItem[] }>(`/chats?page=1&pageSize=${limit}`);
    return res.items;
  } catch {
    return [];
  }
}

export async function listAllChats(
  page: number,
  pageSize = 20,
): Promise<{ items: ChatListItem[]; total: number }> {
  try {
    return await apiFetch<{ items: ChatListItem[]; total: number }>(
      `/chats?page=${page}&pageSize=${pageSize}`,
    );
  } catch {
    return { items: [], total: 0 };
  }
}

/** Создать новый чат. */
export async function createChat(input: ChatInput): Promise<ChatCreated> {
  const res = await apiFetch<{ chat: ChatCreated }>("/chats", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.chat;
}

// ─── Детали чата и сообщения ───────────────────────────────────────────────────

export async function getChat(id: number): Promise<ChatDetail> {
  const res = await apiFetch<{ chat: ChatDetail }>(`/chats/${id}`);
  return res.chat;
}

export async function deleteChat(id: number): Promise<void> {
  await apiFetch(`/chats/${id}`, { method: "DELETE" });
}

// ─── Отправка/редактирование (SSE streaming) ──────────────────────────────────

export type SendMessageEvents = {
  onUserMessage?: (msg: MessageInPath) => void;
  onToken?: (text: string) => void;
  onDone?: (msg: MessageInPath) => void;
  onError?: (message: string) => void;
};

/**
 * Отправляет сообщение и читает SSE-поток ответа ИИ.
 * Вызывает коллбэки по мере прихода событий.
 */
export async function sendMessage(
  chatId: number,
  content: string,
  events: SendMessageEvents,
): Promise<void> {
  await readChatSSE(`/chats/${chatId}/messages`, { content }, events);
}

export async function editMessage(
  chatId: number,
  messageId: number,
  content: string,
  events: SendMessageEvents,
): Promise<void> {
  await readChatSSE(`/chats/${chatId}/messages/${messageId}/edit`, { content }, events);
}

export async function regenerateMessage(
  chatId: number,
  messageId: number,
  events: SendMessageEvents,
): Promise<void> {
  await readChatSSE(`/chats/${chatId}/messages/${messageId}/regenerate`, {}, events);
}

// ─── Ветвление ────────────────────────────────────────────────────────────────

export async function switchBranch(chatId: number, messageId: number): Promise<void> {
  await apiFetch(`/chats/${chatId}/messages/${messageId}/branch`, { method: "POST" });
}

// ─── Перевод ──────────────────────────────────────────────────────────────────

export async function translateMessage(
  chatId: number,
  messageId: number,
  targetLang: string,
): Promise<string> {
  const res = await apiFetch<{ translation: string }>(
    `/chats/${chatId}/messages/${messageId}/translate`,
    { method: "POST", body: JSON.stringify({ targetLang }) },
  );
  return res.translation;
}

// ─── Настройки ────────────────────────────────────────────────────────────────

export async function getChatSettings(chatId: number): Promise<ChatSettings> {
  const res = await apiFetch<{ settings: ChatSettings }>(`/chats/${chatId}/settings`);
  return res.settings;
}

export async function updateChatSettings(
  chatId: number,
  patch: Partial<ChatSettings>,
): Promise<ChatSettings> {
  const res = await apiFetch<{ settings: ChatSettings }>(`/chats/${chatId}/settings`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return res.settings;
}

// ─── Граф ─────────────────────────────────────────────────────────────────────

export async function getChatTree(chatId: number): Promise<TreeNode[]> {
  const res = await apiFetch<{ nodes: TreeNode[] }>(`/chats/${chatId}/tree`);
  return res.nodes;
}

// ─── Внутренний хелпер: чтение SSE-потока ─────────────────────────────────────

async function readChatSSE(
  path: string,
  body: Record<string, unknown>,
  events: SendMessageEvents,
): Promise<void> {
  const base = getApiBase();
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    events.onError?.("Request failed");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const raw = line.slice(6).trim();
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            if (currentEvent === "userMessage") {
              events.onUserMessage?.(parsed as unknown as MessageInPath);
            } else if (currentEvent === "token") {
              events.onToken?.(parsed.text as string);
            } else if (currentEvent === "done") {
              events.onDone?.(parsed as unknown as MessageInPath);
            } else if (currentEvent === "error") {
              events.onError?.(parsed.message as string);
            }
          } catch {
            // Игнорируем неверный JSON в потоке
          }
          currentEvent = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
