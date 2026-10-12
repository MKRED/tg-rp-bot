import { Text } from "@mantine/core";
import { ListRow } from "../../../shared/components/ListCard";
import { formatRelativeDate } from "../../../shared/text/formatRelativeDate";
import { CharacterAvatar } from "../../characters/components/CharacterAvatar";
import type { ChatListItem } from "../types/chat";

interface ChatRowProps {
  chat: ChatListItem;
  /** Порядковый номер строки — задержка появления. */
  index: number;
  onClick: () => void;
}

/** Строка чата в списке: аватар персонажа, название, превью последнего сообщения, время. */
export function ChatRow({ chat, index, onClick }: ChatRowProps) {
  // Пользовательское название чата или имя персонажа по умолчанию.
  const title = chat.title ?? chat.character.name;
  const description = chat.lastMessage
    ? chat.lastMessage
    : chat.persona?.name
      ? `Персона: ${chat.persona.name}`
      : "Нет сообщений";

  return (
    <ListRow
      index={index}
      leading={
        <CharacterAvatar
          id={chat.character.id}
          hasImage={chat.character.hasImage}
          name={chat.character.name}
          size={48}
          enlargeable
        />
      }
      title={title}
      description={description}
      meta={
        chat.lastMessageAt && (
          <Text size="xs" c="dimmed">
            {formatRelativeDate(chat.lastMessageAt)}
          </Text>
        )
      }
      onClick={onClick}
    />
  );
}
