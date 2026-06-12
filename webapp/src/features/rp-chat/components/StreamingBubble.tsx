import { CharacterAvatar } from "../../characters/components/CharacterAvatar";

interface StreamingBubbleProps {
  text: string;
  character: { id: number; name: string; hasImage: boolean };
}

/** Пузырь ответа ИИ во время стриминга: мигающий курсор, текст накапливается. */
export function StreamingBubble({ text, character }: StreamingBubbleProps) {
  return (
    <div className="message-bubble message-bubble--assistant">
      <CharacterAvatar
        id={character.id}
        hasImage={character.hasImage}
        name={character.name}
        size={28}
      />
      <div className="message-bubble__body">
        <p className="message-bubble__text message-bubble__text--streaming">{text}</p>
      </div>
    </div>
  );
}
