import { CharactersRepository } from "../../characters/characters.repository.js";
import { DatabaseService } from "../../database/database.service.js";

/**
 * ВРЕМЕННЫЙ мост для legacy Hono-кода (chats), которому ещё нужен персонаж: тот же
 * CharactersRepository, что в Nest, без дублирования запросов и расшифровки. Удаляется, когда
 * эти домены переедут на Nest и получат репозиторий через DI (CharactersModule его экспортирует).
 */
const repository = new CharactersRepository(new DatabaseService());

/** Полный персонаж по id, только если он принадлежит этому пользователю. */
export const getCharacter = (userId: number, id: number) => repository.findOne(userId, id);
