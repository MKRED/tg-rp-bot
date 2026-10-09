import { ValidationPipe } from "@nestjs/common";

/**
 * Глобальная валидация тел запросов по DTO (class-validator): whitelist отсекает поля, которых
 * нет в DTO, transform отдаёт контроллеру экземпляр DTO с применёнными @Transform и дефолтами.
 * Одна фабрика для приложения и тестов DTO — проверяем ровно то, что работает в проде.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({ whitelist: true, transform: true });
}
