import { parseRpText } from "../../text/parseRpText";
import styles from "./RpText.module.css";

interface RpTextProps {
  text: string;
}

/**
 * RP-текст с визуальным разделением: *действие*, "речь", «мысль». Строчные span'ы без своего шрифта —
 * размер и цвет берутся у контейнера (пузырь, лента истории), цвета действия/мысли — из CSS-переменных
 * контейнера (см. RpText.module.css).
 */
export function RpText({ text }: RpTextProps) {
  const tokens = parseRpText(text);
  return (
    <>
      {tokens.map((token, i) =>
        token.type === "plain" || token.type === "speech" ? (
          <span key={i}>{token.text}</span>
        ) : (
          <span key={i} className={styles[token.type]}>
            {token.text}
          </span>
        ),
      )}
    </>
  );
}
