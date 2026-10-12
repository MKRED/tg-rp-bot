import { Text } from "@mantine/core";
import { ListRow } from "../../../../shared/components/ListCard";
import { formatRelativeDate } from "../../../../shared/text/formatRelativeDate";
import type { StoryListItem } from "../../types/story";
import { StoryAvatars } from "../StoryAvatars";

interface StoryRowProps {
  story: StoryListItem;
  /** Порядковый номер строки — задержка появления. */
  index: number;
  onClick: () => void;
}

/** Строка истории в списке: аватары книги, название (или имя книги), превью последнего бита, время. */
export function StoryRow({ story, index, onClick }: StoryRowProps) {
  // У пустой истории вместо времени последнего бита — момент создания.
  const time = story.lastMessageAt ?? story.createdAt;

  return (
    <ListRow
      index={index}
      leading={<StoryAvatars avatars={story.avatars} />}
      title={story.title ?? story.bookName}
      description={story.lastMessage ?? story.bookName}
      meta={
        <Text size="xs" c="dimmed">
          {formatRelativeDate(time)}
        </Text>
      }
      onClick={onClick}
    />
  );
}
