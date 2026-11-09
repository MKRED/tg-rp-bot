import { Module } from "@nestjs/common";
import { ComfyAgentModule } from "../comfy-agent/comfy-agent.module.js";
import { CanvasGenerationService } from "./generation/canvas-generation.service.js";
import { ImageCanvasItemsRepository } from "./image-canvas-items.repository.js";
import { ImageCanvasController } from "./image-canvas.controller.js";
import { ImageCanvasRepository } from "./image-canvas.repository.js";
import { ImageCanvasService } from "./image-canvas.service.js";

/** /api/image-canvases — раздел «Картинки»: редактирование картинок в ComfyUI пользователя через агента. */
@Module({
  imports: [ComfyAgentModule],
  controllers: [ImageCanvasController],
  providers: [ImageCanvasService, CanvasGenerationService, ImageCanvasRepository, ImageCanvasItemsRepository],
})
export class ImageCanvasModule {}
