import { GitBranch, Settings, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CharacterAvatar } from "../../characters/components/CharacterAvatar";

interface ChatHeaderProps {
  character: { id: number; name: string; hasImage: boolean };
  onSettingsClick: () => void;
  onGraphClick: () => void;
  onDeleteChat: () => void;
}

export function ChatHeader({ character, onSettingsClick, onGraphClick, onDeleteChat }: ChatHeaderProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Сбрасываем состояние подтверждения через 3 секунды если не нажали повторно
  useEffect(() => {
    if (confirmDelete) {
      timerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [confirmDelete]);

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDeleteChat();
    } else {
      setConfirmDelete(true);
    }
  };

  return (
    <div className="chat-header">
      <div className="chat-header__info">
        <CharacterAvatar id={character.id} hasImage={character.hasImage} name={character.name} size={40} />
        <span className="chat-header__name">{character.name}</span>
      </div>
      <div className="chat-header__actions">
        <button
          className="chat-header__icon-btn"
          onClick={onGraphClick}
          aria-label="Граф веток"
          type="button"
        >
          <GitBranch size={20} />
        </button>
        <button
          className="chat-header__icon-btn"
          onClick={onSettingsClick}
          aria-label="Настройки чата"
          type="button"
        >
          <Settings size={20} />
        </button>
        <button
          className={`chat-header__icon-btn${confirmDelete ? " chat-header__icon-btn--danger" : ""}`}
          onClick={handleDeleteClick}
          aria-label={confirmDelete ? "Подтвердить удаление" : "Удалить чат"}
          type="button"
        >
          <Trash2 size={20} />
        </button>
      </div>
    </div>
  );
}
