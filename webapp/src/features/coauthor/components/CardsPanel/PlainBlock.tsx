import { Text, UnstyledButton } from "@mantine/core";
import { useState } from "react";
import type { CoauthorBlock } from "../../types/coauthor";
import styles from "./CardsPanel.module.css";

/** Длиннее этого блок показывается свёрнутым — карточка целиком умещается на экране. */
const COLLAPSE_CHARS = 280;

/** Блок без правки: текст (длинный — свёрнут), пустой — подсказка, как его заполнить. */
export function PlainBlock({ block }: { block: CoauthorBlock }) {
  const [expanded, setExpanded] = useState(false);
  const empty = !block.content.trim();
  const long = block.content.length > COLLAPSE_CHARS;

  return (
    <div className={styles.block} data-empty={empty || undefined}>
      <Text size="sm" fw={600} c="dimmed">
        {block.title}
      </Text>
      {empty ? (
        <Text size="sm" c="dimmed">
          Пусто — попросите ИИ заполнить в чате
        </Text>
      ) : (
        <>
          <div className={styles.text} data-collapsed={(long && !expanded) || undefined}>
            {block.content}
          </div>
          {long && (
            <UnstyledButton className={styles.more} onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Свернуть" : "Показать полностью"}
            </UnstyledButton>
          )}
        </>
      )}
    </div>
  );
}
