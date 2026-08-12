import { Text } from "@telegram-apps/telegram-ui";
import "./RpText.css";
import { parseRpText } from "../../text/parseRpText";

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
          <Text key={i}>{token.text}</Text>
        ) : (
          <Text key={i} className={`rp-token--${token.type}`}>
            {token.text}
          </Text>
        )
      )}
    </>
  );
}
