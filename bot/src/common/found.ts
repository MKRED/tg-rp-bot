import { NotFoundException } from "@nestjs/common";

/**
 * undefined от репозитория — «нет такого у пользователя» → 404 (чужой id неотличим от
 * несуществующего). null пропускается: это «есть, но поле пустое» (например, нет картинки).
 */
export function found<T>(value: T | undefined): T {
  if (value === undefined) throw new NotFoundException("Not found");
  return value;
}
