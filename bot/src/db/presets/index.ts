import { DatabaseService } from "../../database/database.service.js";
import { PresetsRepository } from "../../presets/presets.repository.js";

/**
 * ВРЕМЕННЫЙ мост для legacy Hono-кода (cards, chats, stories), которому ещё нужен пресет: тот же
 * PresetsRepository, что в Nest. Удаляется, когда эти домены переедут на Nest и получат
 * репозиторий через DI (PresetsModule его экспортирует).
 */
const repository = new PresetsRepository(new DatabaseService());

/** Полный пресет по id, только если он принадлежит этому пользователю. */
export const getPreset = (userId: number, id: number) => repository.findOne(userId, id);
