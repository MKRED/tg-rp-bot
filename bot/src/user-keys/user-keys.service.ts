import { Injectable } from "@nestjs/common";
import { unwrapDataKey } from "../utils/index.js";
import { UserKeysRepository } from "./user-keys.repository.js";

/**
 * Ключ шифрования данных пользователя для репозиториев. Ключ случайный и хранится в users.data_key
 * под мастер-ключом; после первого чтения держится в памяти процесса — он не меняется, пока
 * существует пользователь (смена ключа = перешифровка всех его данных, вне работающего бота).
 */
@Injectable()
export class UserKeysService {
  private readonly cache = new Map<string, Buffer>();

  constructor(private readonly keys: UserKeysRepository) {}

  async forUser(userId: string): Promise<Buffer> {
    const cached = this.cache.get(userId);
    if (cached) return cached;
    const wrapped = await this.keys.findWrappedKey(userId);
    // Строку users заводит guard до любого доменного запроса, так что «нет ключа» — баг, а не
    // пользовательская ошибка: шифровать данные без ключа или новым ключом нельзя.
    if (!wrapped) throw new Error(`Нет ключа шифрования у пользователя ${userId}`);
    const key = unwrapDataKey(wrapped);
    this.cache.set(userId, key);
    return key;
  }
}
