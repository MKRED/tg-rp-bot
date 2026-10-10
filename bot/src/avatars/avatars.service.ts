import { BadRequestException, Injectable } from "@nestjs/common";
import { type AvatarBatchResult, type AvatarRef, MAX_AVATAR_BATCH_REFS } from "@tg-rp-bot/shared";
import { AvatarsRepository } from "./avatars.repository.js";

/** Батч-резолв аватаров — источник данных для AvatarStack (список историй, шапка чата narrator). */
@Injectable()
export class AvatarsService {
  constructor(private readonly avatars: AvatarsRepository) {}

  /** Лимит считается по уже отсеянным дескрипторам (DTO выкидывает некорректные), как в Hono. */
  async resolveBatch(userId: string, refs: AvatarRef[]): Promise<AvatarBatchResult[]> {
    if (refs.length === 0) return [];
    if (refs.length > MAX_AVATAR_BATCH_REFS) {
      throw new BadRequestException(`Too many refs (max ${MAX_AVATAR_BATCH_REFS})`);
    }
    return this.avatars.findBatch(userId, refs);
  }
}
