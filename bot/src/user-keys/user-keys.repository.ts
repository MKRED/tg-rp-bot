import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { schema } from "../db/index.js";
import { DatabaseService } from "../database/database.service.js";
import logger from "../logger.js";

@Injectable()
export class UserKeysRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Зашифрованный мастер-ключом ключ пользователя (users.data_key); undefined — пользователя нет. */
  async findWrappedKey(userId: string): Promise<string | undefined> {
    const t0 = Date.now();
    const [row] = await this.database.db
      .select({ dataKey: schema.users.dataKey })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    logger.debug({ durationMs: Date.now() - t0, userId, found: Boolean(row) }, "User data key read");
    return row?.dataKey;
  }
}
