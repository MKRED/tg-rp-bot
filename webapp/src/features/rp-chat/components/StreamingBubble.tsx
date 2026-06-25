import { RpText } from "../../../shared/components/RpText";

interface StreamingBubbleProps {
  text: string;
}

/** Пузырь ответа ИИ во время стриминга: мигающий курсор, текст накапливается. */
export function StreamingBubble({ text }: StreamingBubbleProps) {
  return (
    <div className="message-bubble message-bubble--assistant">
      <div className="message-bubble__body">
        <p className="message-bubble__text message-bubble__text--streaming"><RpText text={text} /></p>
      </div>
    </div>
  );
}
