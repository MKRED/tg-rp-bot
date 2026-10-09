import { DatabaseService } from "../../database/database.service.js";
import { RpTemplatesRepository } from "../../rp-templates/rp-templates.repository.js";

/**
 * ВРЕМЕННЫЙ мост для legacy Hono-кода (chats), которому ещё нужен RP-шаблон: тот же
 * RpTemplatesRepository, что в Nest. Удаляется, когда эти домены переедут на Nest и получат
 * репозиторий через DI (RpTemplatesModule его экспортирует).
 */
const repository = new RpTemplatesRepository(new DatabaseService());

/** Полный RP-шаблон по id, только если он принадлежит этому пользователю. */
export const getRpTemplate = (userId: number, id: number) => repository.findOne(userId, id);
