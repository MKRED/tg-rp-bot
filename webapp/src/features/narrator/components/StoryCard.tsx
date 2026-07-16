import { Avatar, AvatarStack, Cell } from "@telegram-apps/telegram-ui";
import { Clapperboard } from "lucide-react";
import { useAvatarBatch } from "../../../shared/avatar/useAvatarBatch";
import { nameInitials } from "../../../shared/text/initials";
import type { StoryListItem } from "../types/story";
import "./StoryCard.css";

interface StoryCardProps {
  story: StoryListItem;
  onClick: () => void;
}

/** Форматирует дату последнего сообщения: сегодня → время, иначе → дата. */
function formatStoryTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

/**
 * Ячейка истории в списке: до 3 аватаров персонажей/персон из привязанной книги знаний
 * (сортировка книги, топ-3 — story.avatars), название, превью последнего бита, время.
 * Если в книге нет ни одной записи-персонажа/персоны — иконка нарратора (как раньше).
 */
export function StoryCard({ story, onClick }: StoryCardProps) {
  const displayName = story.title ?? story.bookName;
  const subtitle = story.lastMessage ?? story.bookName;
  // На превью показываем время последнего бита, а у пустой истории — момент создания.
  const time = story.lastMessageAt ?? story.createdAt;
  const resolved = useAvatarBatch(story.avatars);

  const before =
    story.avatars.length > 0 ? (
      <AvatarStack>
        {story.avatars.map((a) => (
          <Avatar
            key={`${a.type}:${a.id}`}
            size={24}
            src={resolved.get(`${a.type}:${a.id}`)}
            acronym={nameInitials(a.name)}
          />
        ))}
      </AvatarStack>
    ) : (
      <span className="story-card__icon">
        <Clapperboard size={24} />
      </span>
    );

  return (
    <Cell
      before={before}
      subtitle={<span className="story-card__subtitle">{subtitle}</span>}
      after={time ? <span className="story-card__time">{formatStoryTime(time)}</span> : null}
      onClick={onClick}
    >
      {displayName}
    </Cell>
  );
}
