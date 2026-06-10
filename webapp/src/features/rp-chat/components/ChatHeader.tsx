import type { Character } from "../types/chat";

interface ChatHeaderProps {
  character: Character;
  typing: boolean;
}

/** Шапка сцены: аватар, имя персонажа и статус (печатает / подпись). */
export function ChatHeader({ character, typing }: ChatHeaderProps) {
  return (
    <header className="rp-header">
      <div className="rp-avatar" aria-hidden>
        {character.avatarEmoji}
      </div>
      <div className="rp-header__info">
        <div className="rp-header__name">{character.name}</div>
        <div className="rp-header__status">
          {typing ? "печатает…" : character.tagline}
        </div>
      </div>
    </header>
  );
}
