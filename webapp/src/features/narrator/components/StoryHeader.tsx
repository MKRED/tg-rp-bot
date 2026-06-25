import { GitBranch, Settings } from "lucide-react";

interface StoryHeaderProps {
  /** Заголовок истории (пользовательское название или имя книги). */
  title: string;
  onGraphClick: () => void;
  onSettingsClick: () => void;
}

/** Шапка экрана истории: заголовок слева, кнопки графа веток и настроек справа (как в RP-чате). */
export function StoryHeader({ title, onGraphClick, onSettingsClick }: StoryHeaderProps) {
  return (
    <div className="story-page__header">
      <span className="story-page__header-title">{title}</span>
      <div className="story-page__header-actions">
        <button
          className="story-page__header-btn"
          onClick={onGraphClick}
          aria-label="Граф веток"
          type="button"
        >
          <GitBranch size={22} />
        </button>
        <button
          className="story-page__header-btn"
          onClick={onSettingsClick}
          aria-label="Настройки истории"
          type="button"
        >
          <Settings size={22} />
        </button>
      </div>
    </div>
  );
}
