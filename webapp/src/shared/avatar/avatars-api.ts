import type { AvatarBatchRequest, AvatarBatchResponse, AvatarRef } from "@tg-rp-bot/shared";
import { apiFetch } from "../api/client";

/** Батч-резолв аватаров: массив дескрипторов → data URL там, где картинка есть. */
export function fetchAvatarsBatch(refs: AvatarRef[]): Promise<AvatarBatchResponse> {
  const body: AvatarBatchRequest = { refs };
  return apiFetch<AvatarBatchResponse>("/avatars/batch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
