import { Input, type InputProps } from "@telegram-apps/telegram-ui";
import { FieldHint } from "./FieldHint";
import "./HintedInput.css";

interface HintedInputProps extends InputProps {
  hint: string;
}

/** Однострочный Input с подсказкой под ним. */
export function HintedInput({ hint, ...inputProps }: HintedInputProps) {
  return (
    <div className="hinted-input">
      <Input {...inputProps} />
      <FieldHint className="hinted-input__hint">{hint}</FieldHint>
    </div>
  );
}
