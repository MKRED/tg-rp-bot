import { Cell } from "@telegram-apps/telegram-ui";
import { CharacterAvatar } from "../../characters/components/CharacterAvatar";
import type { ChatListItem } from "../types/chat";
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

/** Ячейка чата в списке: аватар персонажа, имя, персона, превью последнего сообщения. */
export function ChatCard({ chat, onClick }: ChatCardProps) {
  const subtitle = chat.lastMessage
    ? chat.lastMessage
    : chat.personaName
      ? `Персона: ${chat.personaName}`
      : "Нет сообщений";

  return (
    <Cell
      before={
        <CharacterAvatar
          id={chat.characterId}
          hasImage={chat.characterHasImage}
          name={chat.characterName}
          size={48}
        />
      }
      subtitle={<span className="chat-card__subtitle">{subtitle}</span>}
      after={
        chat.lastMessageAt ? (
          <span className="chat-card__time">{formatChatTime(chat.lastMessageAt)}</span>
        ) : null
      }
      onClick={onClick}
    >
      {chat.characterName}
    </Cell>
  );
}
