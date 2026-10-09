import { Global, Module } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

/** Глобальный модуль БД: DatabaseService доступен репозиториям без импорта модуля. */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
