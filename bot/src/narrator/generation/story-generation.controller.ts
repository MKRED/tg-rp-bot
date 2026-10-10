import { Body, Controller, HttpCode, Param, ParseIntPipe, RequestMethod, Sse } from "@nestjs/common";
import { METHOD_METADATA } from "@nestjs/common/constants.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { AdvanceStoryDto } from "./dto/advance-story.dto.js";
import { StoryGenerationService } from "./story-generation.service.js";

/** Штатный @Sse на POST (как в RP-чате): webapp стримит через POST + fetch; Hono-версия отвечала 200. */
const POST = { [METHOD_METADATA]: RequestMethod.POST };

/** Стриминговая narrator-генерация (SSE): advance и регенерация бита. */
@Controller("stories/:id")
export class StoryGenerationController {
  constructor(private readonly generation: StoryGenerationService) {}

  @Sse("advance", POST)
  @HttpCode(200)
  advance(@CurrentUser() userId: string, @Param("id", ParseIntPipe) storyId: number, @Body() { directive }: AdvanceStoryDto) {
    return this.generation.advance(userId, storyId, directive);
  }

  @Sse("messages/:msgId/regenerate", POST)
  @HttpCode(200)
  regenerate(@CurrentUser() userId: string, @Param("id", ParseIntPipe) storyId: number, @Param("msgId", ParseIntPipe) msgId: number) {
    return this.generation.regenerate(userId, storyId, msgId);
  }
}
