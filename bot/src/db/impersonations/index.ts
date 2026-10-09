import { DatabaseService } from "../../database/database.service.js";
import { ImpersonationsRepository } from "../../rp-chat/impersonations/impersonations.repository.js";

/**
 * ВРЕМЕННЫЙ мост для legacy стриминговой генерации варианта impersonate (server/chats): тот же
 * репозиторий, что в Nest (RpChatModule). Удаляется, когда генерация переедет на Nest (@Sse).
 */
const repository = new ImpersonationsRepository(new DatabaseService());

/** Сохраняет вариант момента с FIFO-вытеснением сверх лимита; возвращает его расшифрованным. */
export const insertVariant = (...args: Parameters<ImpersonationsRepository["insert"]>) => repository.insert(...args);
