import { Avatar, AvatarStack } from "@telegram-apps/telegram-ui";
import { GitBranch, Settings } from "lucide-react";
import { useAvatarBatch } from "../../../shared/avatar/useAvatarBatch";
import { nameInitials } from "../../../shared/text/initials";
import type { StoryAvatarRef } from "../types/story";

interface StoryHeaderProps {
  /** Заголовок истории (пользовательское название или имя книги). */
  title: string;
  /** До 5 аватаров персонажей/персон из книги знаний (сортировка книги, топ-5). */
  avatars: StoryAvatarRef[];
  onGraphClick: () => void;
  onSettingsClick: () => void;
}

/**
 * Шапка экрана истории: до 5 аватаров книги знаний + заголовок слева, кнопки графа веток и
 * настроек справа (как в RP-чате). Если в книге нет ни одной записи-персонажа/персоны — стек
 * не рендерится вовсе (как и раньше, когда перед заголовком ничего не было).
 */
export function StoryHeader({ title, avatars, onGraphClick, onSettingsClick }: StoryHeaderProps) {
  const resolved = useAvatarBatch(avatars);

  return (
    <div className="story-page__header">
      {avatars.length > 0 && (
        <AvatarStack className="story-page__header-avatars">
          {avatars.map((a) => (
            <Avatar
              key={`${a.type}:${a.id}`}
              size={28}
              src={resolved.get(`${a.type}:${a.id}`)}
              acronym={nameInitials(a.name)}
              style={{ backgroundColor: "var(--tgui--secondary_bg_color)" }}
            />
          ))}
        </AvatarStack>
      )}
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
