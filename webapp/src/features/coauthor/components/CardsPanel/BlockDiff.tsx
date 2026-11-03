import { useMemo } from "react";
import { wordDiff } from "../../lib/wordDiff";
import styles from "./CardsPanel.module.css";

export type DiffMode = "changes" | "before" | "after";

/** Текст предложенной правки: изменения подсветкой (удалённое зачёркнуто), либо «было» / «стало» целиком. */
export function BlockDiff({ before, after, mode }: { before: string; after: string; mode: DiffMode }) {
  const segments = useMemo(() => wordDiff(before, after), [before, after]);
  if (mode === "before") return <div className={styles.text}>{before || "Пусто"}</div>;
  if (mode === "after") return <div className={styles.text}>{after}</div>;
  return (
    <div className={styles.text}>
      {segments.map((s, i) =>
        s.type === "same" ? (
          <span key={i}>{s.text}</span>
        ) : s.type === "del" ? (
          <del key={i} className={styles.del}>
            {s.text}
          </del>
        ) : (
          <ins key={i} className={styles.ins}>
            {s.text}
          </ins>
        ),
      )}
    </div>
  );
}
