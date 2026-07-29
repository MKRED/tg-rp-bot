import type { CardCategory } from "../schema.js";

/**
 * Дефолтный основной промпт новой карточки. Содержит {{example}} неявно (через автодобавление
 * в конец при сборке — см. assembleCardBlockPrompt), пользователь может вставить плейсхолдер
 * явно, если хочет переставить структуру внутрь текста.
 */
export const DEFAULT_CARD_PROMPT = "Create a highly detailed AI character card";

/**
 * Дефолтная структура карточки — набор категорий по образцу типичной карточки персонажа.
 * description — пример формата для этой категории (что ИИ должен сгенерировать), content —
 * пусто (ещё не сгенерирован). Полностью редактируется пользователем в форме карточки.
 */
export const DEFAULT_CARD_CATEGORIES: CardCategory[] = [
  {
    id: "base",
    title: "Base",
    description: "Name: ...\nRace: ...\nSex: ...\nAge: ...\nHeight: ...",
    content: "",
    enabled: true,
  },
  {
    id: "body",
    title: "Body",
    description: "Подробное описание телосложения, черт лица, особых примет.",
    content: "",
    enabled: true,
  },
  {
    id: "outfit",
    title: "Outfit",
    description: "Повседневный наряд персонажа, аксессуары.",
    content: "",
    enabled: true,
  },
  {
    id: "personality",
    title: "Personality",
    description: "Черты характера, ценности, страхи, мотивация.",
    content: "",
    enabled: true,
  },
  {
    id: "speechStyle",
    title: "Speech Style",
    description: "Манера речи, характерные фразы, тон.",
    content: "",
    enabled: true,
  },
  {
    id: "behaviours",
    title: "Behaviours",
    description: "Типичные привычки и реакции в разных ситуациях.",
    content: "",
    enabled: true,
  },
  {
    id: "hobbiesLikes",
    title: "Hobbies / Likes",
    description: "Увлечения и то, что персонажу нравится.",
    content: "",
    enabled: true,
  },
  {
    id: "dislikes",
    title: "Dislikes",
    description: "То, что персонаж не любит или чего избегает.",
    content: "",
    enabled: true,
  },
  {
    id: "background",
    title: "Background",
    description: "История персонажа, прошлое, ключевые события.",
    content: "",
    enabled: true,
  },
];
