import { DEFAULT_CHATS_PAGE_SIZE, MAX_CHATS_PAGE_SIZE } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsInt } from "class-validator";
import { queryInt } from "../../../common/query-int.js";

/** Query GET /api/chats: страница от 1, размер страницы 1..MAX (вне диапазона — приводим, не 400). */
export class ListChatsQueryDto {
  @Transform(({ value }) => Math.max(1, queryInt(value, 1)))
  @IsInt()
  page: number = 1;

  @Transform(({ value }) => Math.min(MAX_CHATS_PAGE_SIZE, Math.max(1, queryInt(value, DEFAULT_CHATS_PAGE_SIZE))))
  @IsInt()
  pageSize: number = DEFAULT_CHATS_PAGE_SIZE;
}
