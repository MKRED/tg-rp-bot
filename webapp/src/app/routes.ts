/**
 * Пути маршрутов приложения. Держим в одном месте, чтобы навигация и определения
 * маршрутов не расходились. По мере роста сюда добавляются экраны настроек/персонажей/перевода.
 */
export const ROUTES = {
  /** Главная — экран, на который попадаем при открытии приложения. */
  home: "/",
  /** Хаб ролевых чатов: последние 5 + кнопки «Все чаты» и «Новый чат». */
  chats: "/chats",
  /** Форма создания нового чата (выбор персонажа, персоны, пресета). */
  chatNew: "/chats/new",
  /** Полный список чатов с пагинацией. */
  chatAll: "/chats/all",
  /** Экран конкретного чата по id. */
  chatView: "/chats/:id",
  /** Список персонажей пользователя. */
  characters: "/characters",
  /** Форма создания нового персонажа. */
  characterNew: "/characters/new",
  /** Форма редактирования персонажа по id (react-router v6: статический `new` приоритетнее `:id`). */
  characterEdit: "/characters/:id",
  /** Список пресетов «Настройки ответа ИИ». */
  presets: "/presets",
  /** Форма создания нового пресета. */
  presetNew: "/presets/new",
  /** Форма редактирования пресета по id (статический `new` приоритетнее `:id`). */
  presetEdit: "/presets/:id",
  /** Настройки конкретного чата (перевод и др.). */
  chatSettings: "/chats/:id/settings",
  /** Граф веток конкретного чата. */
  chatGraph: "/chats/:id/graph",
  /** Список персон пользователя. */
  personas: "/personas",
  /** Форма создания новой персоны. */
  personaNew: "/personas/new",
  /** Форма редактирования персоны по id (статический `new` приоритетнее `:id`). */
  personaEdit: "/personas/:id",

  // ─── Narrator-режим («Режиссёр истории») ───────────────────────────────────
  /** Хаб историй: последние 5 + кнопки «Все истории» и «Новая история». */
  stories: "/stories",
  /** Форма создания новой истории (книга + шаблон + пресет + открытие + премиза). */
  storyNew: "/stories/new",
  /** Полный список историй с пагинацией. */
  storyAll: "/stories/all",
  /** Экран конкретной истории по id. */
  storyView: "/stories/:id",
  /** Настройки конкретной истории (название, привязки, премиза, удаление). */
  storySettings: "/stories/:id/settings",
  /** Граф веток конкретной истории. */
  storyGraph: "/stories/:id/graph",
  /** Список книг знаний. */
  books: "/books",
  /** Форма создания новой книги знаний. */
  bookNew: "/books/new",
  /** Форма редактирования книги знаний по id (статический `new` приоритетнее `:id`). */
  bookEdit: "/books/:id",
  /** Список narrator-шаблонов. */
  narratorTemplates: "/narrator-templates",
  /** Форма создания нового narrator-шаблона. */
  narratorTemplateNew: "/narrator-templates/new",
  /** Форма редактирования narrator-шаблона по id (статический `new` приоритетнее `:id`). */
  narratorTemplateEdit: "/narrator-templates/:id",

  /** Экран отладки: RAW-запросы к LLM и управление перехватом. */
  debugLlm: "/debug/llm",
} as const;

/** Путь к конкретной истории. */
export const storyViewPath = (id: number): string => `/stories/${id}`;

/** Путь к настройкам конкретной истории. */
export const storySettingsPath = (id: number): string => `/stories/${id}/settings`;

/** Путь к графу веток конкретной истории. */
export const storyGraphPath = (id: number): string => `/stories/${id}/graph`;

/** Путь к редактированию книги знаний. */
export const bookEditPath = (id: number): string => `/books/${id}`;

/** Путь к редактированию narrator-шаблона. */
export const narratorTemplateEditPath = (id: number): string => `/narrator-templates/${id}`;

/** Путь к конкретному чату. */
export const chatViewPath = (id: number): string => `/chats/${id}`;

/** Путь к настройкам конкретного чата. */
export const chatSettingsPath = (id: number): string => `/chats/${id}/settings`;

/** Путь к графу конкретного чата. */
export const chatGraphPath = (id: number): string => `/chats/${id}/graph`;

/** Путь к редактированию конкретного персонажа. */
export const characterEditPath = (id: number): string => `/characters/${id}`;

/** Путь к редактированию конкретного пресета. */
export const presetEditPath = (id: number): string => `/presets/${id}`;

/** Путь к редактированию конкретной персоны. */
export const personaEditPath = (id: number): string => `/personas/${id}`;

/**
 * Родительский маршрут для кнопки «Назад» — возврат вверх по иерархии, а не по истории.
 * Так после, например, удаления пресета (→ список) «Назад» ведёт на главную, а не на
 * только что удалённый пресет. Вложенные экраны (`/characters/:id`, `/presets/new` …)
 * возвращают к своему списку; списки и чат — на главную.
 */
export function parentPath(pathname: string): string {
  if (pathname.startsWith("/characters/")) return ROUTES.characters;
  if (pathname.startsWith("/presets/")) return ROUTES.presets;
  if (pathname.startsWith("/personas/")) return ROUTES.personas;
  if (/^\/chats\/\d+\/(settings|graph)$/.test(pathname)) {
    // Настройки и граф → назад к чату
    const id = pathname.split("/")[2];
    return `/chats/${id}`;
  }
  if (pathname.startsWith("/chats/")) return ROUTES.chats;
  if (/^\/stories\/\d+\/(settings|graph)$/.test(pathname)) {
    // Настройки и граф истории → назад к самой истории
    const id = pathname.split("/")[2];
    return `/stories/${id}`;
  }
  if (pathname.startsWith("/stories/")) return ROUTES.stories;
  if (pathname.startsWith("/books/")) return ROUTES.books;
  if (pathname.startsWith("/narrator-templates/")) return ROUTES.narratorTemplates;
  if (pathname.startsWith("/debug/")) return ROUTES.home;
  return ROUTES.home;
}
