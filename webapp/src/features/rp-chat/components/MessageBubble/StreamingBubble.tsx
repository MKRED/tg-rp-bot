import { Loader, Text } from "@mantine/core";
import { RpText } from "../../../../shared/components/RpText";
import styles from "./MessageBubble.module.css";

interface StreamingBubbleProps {
  /** Накопленный текст ответа; пустой — первые токены ещё не пришли. */
  text: string;
}

/** Ответ ИИ во время генерации: пока токенов нет — «печатает» точками, дальше текст с мигающим курсором. */
export function StreamingBubble({ text }: StreamingBubbleProps) {
  return (
    <div className={styles.row} data-role="assistant">
      <div className={styles.column}>
        <Text component="div" className={styles.bubble} data-streaming={text ? true : undefined} aria-live="polite">
          {text ? <RpText text={text} /> : <Loader type="dots" size="sm" aria-label="ИИ печатает" />}
        </Text>
      </div>
    </div>
  );
}
