import { Loader, Text } from "@mantine/core";
import { BeatText } from "../StoryMessageItem/BeatText";
import styles from "./StoryFeed.module.css";

interface StreamingBeatProps {
  /** Накопленный текст бита; пустой — первые токены ещё не пришли. */
  text: string;
  /** Перед битом идёт авто-сжатие истории — подписываем, почему ждём дольше обычного. */
  compacting: boolean;
}

/** Бит во время генерации: пока токенов нет — точки (и «Сжимаю историю…»), дальше текст с курсором. */
export function StreamingBeat({ text, compacting }: StreamingBeatProps) {
  if (!text) {
    return (
      <div className={styles.status} aria-live="polite">
        <Loader type="dots" size="sm" aria-label="Рассказчик пишет" />
        {compacting && (
          <Text size="sm" c="dimmed">
            Сжимаю историю…
          </Text>
        )}
      </div>
    );
  }
  return <BeatText text={text} streaming />;
}
