import {
  BookOpen,
  Bug,
  Clapperboard,
  FileText,
  type LucideIcon,
  MessageCircle,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Smile,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { ROUTES } from "../../app/routes";

export interface HomeMenuItem {
  icon: LucideIcon;
  label: string;
  description?: string;
  /** Нет маршрута — пункт ещё в разработке («Скоро»). */
  route?: string;
}

export interface HomeMenuSection {
  title: string;
  items: HomeMenuItem[];
}

/** Меню главной: группы экранов приложения. */
export const HOME_MENU: HomeMenuSection[] = [
  {
    title: "Режим игры",
    items: [
      { icon: MessageCircle, label: "Ролевой чат", description: "Диалог с одним персонажем", route: ROUTES.chats },
      { icon: Clapperboard, label: "Режиссёр истории", description: "ИИ ведёт историю, вы направляете", route: ROUTES.stories },
      { icon: Users, label: "Группа персонажей" },
    ],
  },
  {
    title: "Библиотека",
    items: [
      { icon: User, label: "Персонажи", description: "Ваши персонажи", route: ROUTES.characters },
      { icon: Smile, label: "Персоны", description: "От чьего лица вы играете", route: ROUTES.personas },
      { icon: BookOpen, label: "Книги знаний", description: "Персонажи и факты мира для историй", route: ROUTES.books },
    ],
  },
  {
    title: "Мастерская",
    items: [{ icon: Sparkles, label: "Карточки", description: "Крафт карточек персонажей и персон", route: ROUTES.cards }],
  },
  {
    title: "Конфигурация",
    items: [
      { icon: SlidersHorizontal, label: "Настройки ответа ИИ", description: "Пресеты параметров генерации", route: ROUTES.presets },
      { icon: FileText, label: "RP-шаблоны", description: "Промпты RP-чата", route: ROUTES.rpTemplates },
      { icon: ScrollText, label: "Narrator-шаблоны", description: "Инструкции нарратора", route: ROUTES.narratorTemplates },
    ],
  },
  {
    title: "Приложение",
    items: [
      { icon: Settings, label: "Настройки", description: "Тема, ключи ИИ и поиска, перевод", route: ROUTES.settings },
      { icon: Bug, label: "Запросы к ИИ", description: "Последние RAW-запросы и перехват", route: ROUTES.debugLlm },
    ],
  },
];
