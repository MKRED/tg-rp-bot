import { Cell } from "@telegram-apps/telegram-ui";
import { Clapperboard } from "lucide-react";
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

/** Ячейка истории в списке: иконка нарратора, название, превью последнего бита, время. */
export function StoryCard({ story, onClick }: StoryCardProps) {
  const displayName = story.title ?? story.bookName;
  const subtitle = story.lastMessage ?? story.bookName;
  // На превью показываем время последнего бита, а у пустой истории — момент создания.
  const time = story.lastMessageAt ?? story.createdAt;

  return (
    <Cell
      before={
        <span className="story-card__icon">
          <Clapperboard size={24} />
        </span>
      }
      subtitle={<span className="story-card__subtitle">{subtitle}</span>}
      after={time ? <span className="story-card__time">{formatStoryTime(time)}</span> : null}
      onClick={onClick}
    >
      {displayName}
    </Cell>
  );
}
