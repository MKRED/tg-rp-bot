import { Settings } from "lucide-react";

interface StoryHeaderProps {
  /** Заголовок истории (пользовательское название или имя книги). */
  title: string;
  onSettingsClick: () => void;
}

/** Шапка экрана истории: заголовок слева, кнопка-шестерёнка настроек справа (как в RP-чате). */
export function StoryHeader({ title, onSettingsClick }: StoryHeaderProps) {
  return (
    <div className="story-page__header">
      <span className="story-page__header-title">{title}</span>
      <button
        className="story-page__header-btn"
        onClick={onSettingsClick}
        aria-label="Настройки истории"
        type="button"
      >
        <Settings size={22} />
      </button>
    </div>
  );
}
