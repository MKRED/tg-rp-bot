import { Caption, Cell } from "@telegram-apps/telegram-ui";
import { CharacterAvatar } from "../../../characters/components/CharacterAvatar";
import type { ChatListItem } from "../../types/chat";
import "./ChatCard.css";

interface ChatCardProps {
  chat: ChatListItem;
  onClick: () => void;
}

/** Форматирует дату последнего сообщения: сегодня → время, иначе → дата. */
function formatChatTime(iso: string): string {
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

/** Ячейка чата в списке: аватар персонажа, название, персона, превью последнего сообщения. */
export function ChatCard({ chat, onClick }: ChatCardProps) {
  // Заголовок ячейки — пользовательское название чата или имя персонажа по умолчанию
  const displayName = chat.title ?? chat.character.name;
  const subtitle = chat.lastMessage
    ? chat.lastMessage
    : chat.persona?.name
      ? `Персона: ${chat.persona.name}`
      : "Нет сообщений";

  return (
    <Cell
      before={
        <CharacterAvatar
          id={chat.character.id}
          hasImage={chat.character.hasImage}
          name={chat.character.name}
          size={48}
        />
      }
      subtitle={subtitle}
      after={
        chat.lastMessageAt ? (
          <Caption level="2" Component="span" className="chat-card__time">
            {formatChatTime(chat.lastMessageAt)}
          </Caption>
        ) : null
      }
      onClick={onClick}
    >
      {displayName}
    </Cell>
  );
}
