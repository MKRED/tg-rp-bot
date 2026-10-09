import { Module } from "@nestjs/common";
import { CharactersController } from "./characters.controller.js";
import { CharactersRepository } from "./characters.repository.js";
import { CharactersService } from "./characters.service.js";

@Module({
  controllers: [CharactersController],
  providers: [CharactersService, CharactersRepository],
  exports: [CharactersRepository],
})
export class CharactersModule {}
