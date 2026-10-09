import { AVATAR_TYPES, type AvatarBatchRequest, type AvatarRef } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsArray } from "class-validator";

/** Корректный дескриптор → чистый { type, id }; прочее → null (выпадает из батча). */
function toRef(raw: unknown): AvatarRef | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { type, id } = raw as { type?: unknown; id?: unknown };
  if (!AVATAR_TYPES.includes(type as AvatarRef["type"]) || !Number.isInteger(id)) return null;
  return { type: type as AvatarRef["type"], id: id as number };
}

/**
 * Тело POST /avatars/batch. Исторически снисходительно: некорректный дескриптор молча выпадает
 * (как и не найденный/чужой аватар в ответе), 400 — только когда refs вообще не массив.
 */
export class AvatarBatchDto implements AvatarBatchRequest {
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map(toRef).filter((r): r is AvatarRef => r !== null) : undefined,
  )
  @IsArray({ message: "refs must be an array" })
  refs!: AvatarRef[];
}
