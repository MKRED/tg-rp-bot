/**
 * Пути маршрутов приложения. Держим в одном месте, чтобы навигация и определения
 * маршрутов не расходились. По мере роста сюда добавляются экраны настроек/персонажей/перевода.
 */
export const ROUTES = {
  /** Главная — экран, на который попадаем при открытии приложения. */
  home: "/",
  /** RP-чат «один на один». */
  chat: "/chat",
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
} as const;

/** Путь к редактированию конкретного персонажа. */
export const characterEditPath = (id: number): string => `/characters/${id}`;

/** Путь к редактированию конкретного пресета. */
export const presetEditPath = (id: number): string => `/presets/${id}`;

/**
 * Родительский маршрут для кнопки «Назад» — возврат вверх по иерархии, а не по истории.
 * Так после, например, удаления пресета (→ список) «Назад» ведёт на главную, а не на
 * только что удалённый пресет. Вложенные экраны (`/characters/:id`, `/presets/new` …)
 * возвращают к своему списку; списки и чат — на главную.
 */
export function parentPath(pathname: string): string {
  if (pathname.startsWith("/characters/")) return ROUTES.characters;
  if (pathname.startsWith("/presets/")) return ROUTES.presets;
  return ROUTES.home;
}
