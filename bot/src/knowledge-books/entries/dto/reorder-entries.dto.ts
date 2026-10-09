import type { ReorderEntriesRequest } from "@tg-rp-bot/shared";
import { IsArray, IsInt } from "class-validator";

const INVALID = { message: "order must be an array of integers" };

/** Тело PUT /books/:id/entries/reorder. Что это ровно перестановка записей книги — проверяет репозиторий. */
export class ReorderEntriesDto implements ReorderEntriesRequest {
  @IsArray(INVALID)
  @IsInt({ ...INVALID, each: true })
  order!: number[];
}
