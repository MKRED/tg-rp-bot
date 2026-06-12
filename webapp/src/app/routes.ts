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
  /** Список персон пользователя. */
  personas: "/personas",
  /** Форма создания новой персоны. */
  personaNew: "/personas/new",
  /** Форма редактирования персоны по id (статический `new` приоритетнее `:id`). */
  personaEdit: "/personas/:id",
} as const;

/** Путь к конкретному чату. */
export const chatViewPath = (id: number): string => `/chats/${id}`;

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
  if (pathname.startsWith("/chats/")) return ROUTES.chats;
  return ROUTES.home;
}
