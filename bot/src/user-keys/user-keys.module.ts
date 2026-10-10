import { Global, Module } from "@nestjs/common";
import { UserKeysRepository } from "./user-keys.repository.js";
import { UserKeysService } from "./user-keys.service.js";

/** Глобальный: ключ пользователя нужен почти каждому доменному репозиторию (как DatabaseService). */
@Global()
@Module({
  providers: [UserKeysService, UserKeysRepository],
  exports: [UserKeysService],
})
export class UserKeysModule {}
