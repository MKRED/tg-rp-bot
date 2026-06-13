import "./RpText.css";
import { parseRpText } from "../lib/parseRpText";

interface RpTextProps {
  text: string;
}

/** Рендерит RP-текст с визуальным разделением: *действие*, "речь", «мысль». */
export function RpText({ text }: RpTextProps) {
  const tokens = parseRpText(text);
  return (
    <>
      {tokens.map((token, i) =>
        token.type === "plain" ? (
          <span key={i}>{token.text}</span>
        ) : (
          <span key={i} className={`rp-token--${token.type}`}>
            {token.text}
          </span>
        )
      )}
    </>
  );
}
