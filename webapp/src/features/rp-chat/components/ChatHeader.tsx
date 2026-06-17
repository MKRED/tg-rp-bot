import { GitBranch, Settings } from "lucide-react";
import { CharacterAvatar } from "../../characters/components/CharacterAvatar";

interface ChatHeaderProps {
  character: { id: number; name: string; hasImage: boolean };
  onSettingsClick: () => void;
  onGraphClick: () => void;
}

export function ChatHeader({ character, onSettingsClick, onGraphClick }: ChatHeaderProps) {
  return (
    <div className="chat-header">
      <div className="chat-header__info">
        <CharacterAvatar id={character.id} hasImage={character.hasImage} name={character.name} size={40} enlargeable />
        <span className="chat-header__name">{character.name}</span>
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
