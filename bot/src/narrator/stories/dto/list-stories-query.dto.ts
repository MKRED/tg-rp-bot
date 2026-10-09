import { DEFAULT_STORIES_PAGE_SIZE, MAX_STORIES_PAGE_SIZE } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsInt } from "class-validator";
import { queryInt } from "../../../common/query-int.js";

/** Query GET /api/stories: страница от 1, размер страницы 1..MAX (вне диапазона — приводим, не 400). */
export class ListStoriesQueryDto {
  @Transform(({ value }) => Math.max(1, queryInt(value, 1)))
  @IsInt()
  page: number = 1;

  @Transform(({ value }) => Math.min(MAX_STORIES_PAGE_SIZE, Math.max(1, queryInt(value, DEFAULT_STORIES_PAGE_SIZE))))
  @IsInt()
  pageSize: number = DEFAULT_STORIES_PAGE_SIZE;
}
