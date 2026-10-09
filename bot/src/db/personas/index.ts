import { DatabaseService } from "../../database/database.service.js";
import { PersonasRepository } from "../../personas/personas.repository.js";

/**
 * ВРЕМЕННЫЙ мост для legacy Hono-кода (books, chats), которому ещё нужна персона: тот же
 * PersonasRepository, что в Nest. Удаляется, когда эти домены переедут на Nest и получат
 * репозиторий через DI (PersonasModule его экспортирует).
 */
const repository = new PersonasRepository(new DatabaseService());

/** Полная персона по id, только если она принадлежит этому пользователю. */
export const getPersona = (userId: number, id: number) => repository.findOne(userId, id);
