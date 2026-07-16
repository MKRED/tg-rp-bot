import { apiFetch } from "../api/client";
import type { AvatarRef } from "./avatarCache";

type AvatarBatchResult = { type: "character" | "persona"; id: number; dataUrl: string };

/** Батч-резолв аватаров: массив дескрипторов → data URL там, где картинка есть. */
export function fetchAvatarsBatch(refs: AvatarRef[]): Promise<{ avatars: AvatarBatchResult[] }> {
  return apiFetch<{ avatars: AvatarBatchResult[] }>("/avatars/batch", {
    method: "POST",
    body: JSON.stringify({ refs }),
  });
}
