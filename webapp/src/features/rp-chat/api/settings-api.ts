import { apiFetch } from "../../../shared/api/client";
import type { ChatSettings } from "../types/chat";

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
