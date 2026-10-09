import { DEFAULT_CHATS_PAGE_SIZE, MAX_CHATS_PAGE_SIZE } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsInt } from "class-validator";

/**
 * Число из query: повтор параметра (?page=1&page=2) → первое значение, как c.req.query в Hono.
 * Нечисловое значение → дефолт, дробь — отбрасываем (в Hono такие доходили до SQL и давали 500).
 */
function queryInt(raw: unknown, fallback: number): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** Query GET /api/chats: страница от 1, размер страницы 1..MAX (вне диапазона — приводим, не 400). */
export class ListChatsQueryDto {
  @Transform(({ value }) => Math.max(1, queryInt(value, 1)))
  @IsInt()
  page: number = 1;

  @Transform(({ value }) => Math.min(MAX_CHATS_PAGE_SIZE, Math.max(1, queryInt(value, DEFAULT_CHATS_PAGE_SIZE))))
  @IsInt()
  pageSize: number = DEFAULT_CHATS_PAGE_SIZE;
}
