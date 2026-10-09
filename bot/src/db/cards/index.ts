import { CardsRepository } from "../../cards/cards.repository.js";
import { DatabaseService } from "../../database/database.service.js";

/**
 * ВРЕМЕННЫЙ мост для legacy-генерации блоков карточки (server/cards/generation): тот же
 * CardsRepository, что в Nest. Удаляется вместе с переносом генерации в Nest.
 */
const repository = new CardsRepository(new DatabaseService());

/** Полная карточка по id, только если она принадлежит этому пользователю. */
export const getCard = (userId: number, id: number) => repository.findOne(userId, id);

export const setCardCategoryContent = repository.setCategoryContent.bind(repository);
export const setCardCategoryPendingQuestions = repository.setCategoryPendingQuestions.bind(repository);
export const clearCardCategoryAskUserAnswers = repository.clearCategoryAskUserAnswers.bind(repository);
export const applyCardCategoryAnswers = repository.applyCategoryAnswers.bind(repository);
