import { Module } from "@nestjs/common";
import { NarratorTemplatesController } from "./narrator-templates.controller.js";
import { NarratorTemplatesRepository } from "./narrator-templates.repository.js";
import { NarratorTemplatesService } from "./narrator-templates.service.js";

@Module({
  controllers: [NarratorTemplatesController],
  providers: [NarratorTemplatesService, NarratorTemplatesRepository],
  exports: [NarratorTemplatesRepository],
})
export class NarratorTemplatesModule {}
