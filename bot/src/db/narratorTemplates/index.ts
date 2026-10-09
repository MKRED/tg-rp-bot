import { DatabaseService } from "../../database/database.service.js";
import { NarratorTemplatesRepository } from "../../narrator-templates/narrator-templates.repository.js";

/**
 * ВРЕМЕННЫЙ мост для legacy Hono-кода (stories), которому ещё нужен narrator-шаблон: тот же
 * NarratorTemplatesRepository, что в Nest. Удаляется, когда эти домены переедут на Nest и получат
 * репозиторий через DI (NarratorTemplatesModule его экспортирует).
 */
const repository = new NarratorTemplatesRepository(new DatabaseService());

/** Полный narrator-шаблон по id, только если он принадлежит этому пользователю. */
export const getNarratorTemplate = (userId: number, id: number) => repository.findOne(userId, id);
