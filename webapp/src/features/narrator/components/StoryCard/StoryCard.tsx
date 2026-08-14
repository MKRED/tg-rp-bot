import { Avatar, AvatarStack, Caption, Cell } from "@telegram-apps/telegram-ui";
import { Clapperboard } from "lucide-react";
import { useAvatarBatch } from "../../../../shared/avatar/useAvatarBatch";
import { nameInitials } from "../../../../shared/text/initials";
import type { StoryListItem } from "../../types/story";
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
 * Ячейка истории в списке: название, превью последнего бита, дата — в hint; справа (after)
 * до 3 аватаров персонажей/персон из привязанной книги знаний (сортировка книги, топ-3 —
 * story.avatars). Если в книге нет ни одной записи-персонажа/персоны — иконка нарратора (как раньше).
 */
export function StoryCard({ story, onClick }: StoryCardProps) {
  const displayName = story.title ?? story.bookName;
  const subtitle = story.lastMessage ?? story.bookName;
  // На превью показываем время последнего бита, а у пустой истории — момент создания.
  const time = story.lastMessageAt ?? story.createdAt;
  const resolved = useAvatarBatch(story.avatars);

  const after =
    story.avatars.length > 0 ? (
      <AvatarStack>
        {story.avatars.map((a) => (
          <Avatar
            key={`${a.type}:${a.id}`}
            size={40}
            src={resolved.get(`${a.type}:${a.id}`)}
            acronym={nameInitials(a.name)}
            // Фон буквенного fallback у tgui — полупрозрачный --tgui--secondary_fill; при наложении
            // в AvatarStack сквозь него просвечивает соседний аватар. Красим непрозрачным.
            style={{ backgroundColor: "var(--tgui--secondary_bg_color)" }}
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
      after={after}
      hint={
        time ? (
          <Caption level="2" Component="span" className="story-card__time">
            {formatStoryTime(time)}
          </Caption>
        ) : null
      }
      subtitle={subtitle}
      onClick={onClick}
    >
      {displayName}
    </Cell>
  );
}
