import { Text } from "@mantine/core";
import { RpText } from "../../../../shared/components/RpText";
import styles from "./StoryMessageItem.module.css";

interface BeatTextProps {
  text: string;
  /** Бит ещё генерируется — мигающий курсор в конце. */
  streaming?: boolean;
}

/** Текст бита — проза на всю ширину колонки, без пузыря. */
export function BeatText({ text, streaming }: BeatTextProps) {
  return (
    <Text
      component="div"
      className={styles.beat}
      data-streaming={streaming || undefined}
      aria-live={streaming ? "polite" : undefined}
    >
      <RpText text={text} />
    </Text>
  );
}
