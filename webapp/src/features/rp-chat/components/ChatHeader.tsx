import { Subheadline } from "@telegram-apps/telegram-ui";
import { GitBranch, Settings } from "lucide-react";
import { CharacterAvatar } from "../../characters/components/CharacterAvatar";

interface ChatHeaderProps {
  character: { id: number; name: string; hasImage: boolean };
  /** Пользовательское название чата; null → показываем имя персонажа. */
  title: string | null;
  onSettingsClick: () => void;
  onGraphClick: () => void;
}

export function ChatHeader({ character, title, onSettingsClick, onGraphClick }: ChatHeaderProps) {
  return (
    <div className="chat-header">
      <div className="chat-header__info">
        <CharacterAvatar id={character.id} hasImage={character.hasImage} name={character.name} size={40} enlargeable />
        <Subheadline level="1" weight="2" Component="span" className="chat-header__name">{title ?? character.name}</Subheadline>
      </div>
      <div className="chat-header__actions">
        <button
          className="chat-header__icon-btn"
          onClick={onGraphClick}
          aria-label="Граф веток"
          type="button"
        >
          <GitBranch size={24} />
        </button>
        <button
          className="chat-header__icon-btn"
          onClick={onSettingsClick}
          aria-label="Настройки чата"
          type="button"
        >
          <Settings size={24} />
        </button>
      </div>
    </div>
  );
}
