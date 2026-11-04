import { apiFetch } from "../../../shared/api/client";
import type {
  CoauthorChat,
  CoauthorChatInput,
  CoauthorChatListItem,
  CoauthorReviewResult,
} from "../types/coauthor";

export function listCoauthorChats(): Promise<{ chats: CoauthorChatListItem[] }> {
  return apiFetch("/coauthor");
}

export function getCoauthorChat(id: number): Promise<{ chat: CoauthorChat }> {
  return apiFetch(`/coauthor/${id}`);
}

export function createCoauthorChat(input: CoauthorChatInput): Promise<{ chat: CoauthorChat }> {
  return apiFetch("/coauthor", { method: "POST", body: JSON.stringify(input) });
}

export function updateCoauthorChat(id: number, input: CoauthorChatInput): Promise<{ chat: CoauthorChat }> {
  return apiFetch(`/coauthor/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function removeCoauthorChat(id: number): Promise<{ ok: true }> {
  return apiFetch(`/coauthor/${id}`, { method: "DELETE" });
}

export function reviewCoauthorProposals(id: number, proposalIds: string[], accept: boolean): Promise<CoauthorReviewResult> {
  return apiFetch(`/coauthor/${id}/review`, { method: "POST", body: JSON.stringify({ proposalIds, accept }) });
}

export function clearCoauthorChat(id: number): Promise<{ chat: CoauthorChat }> {
  return apiFetch(`/coauthor/${id}/clear`, { method: "POST" });
}
