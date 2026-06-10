import { Select } from "@telegram-apps/telegram-ui";
import { SwitchRow } from "./SwitchRow";
import { REASONING_EFFORTS, REASONING_EFFORT_LABELS, type ReasoningEffort } from "./types";

interface ReasoningSectionProps {
  requestReasoning: boolean;
  reasoningEffort: ReasoningEffort;
  onRequestReasoning: (value: boolean) => void;
  onReasoningEffort: (value: ReasoningEffort) => void;
}

/** Секция рассуждения: тумблер «запрашивать рассуждение» + выбор уровня (виден при включении). */
export function ReasoningSection({
  requestReasoning,
  reasoningEffort,
  onRequestReasoning,
  onReasoningEffort,
}: ReasoningSectionProps) {
  return (
    <>
      <SwitchRow
        label="Запрашивать рассуждение"
        hint="Просит модель «думать» перед ответом (только для reasoning-моделей)."
        checked={requestReasoning}
        onChange={onRequestReasoning}
      />
      {requestReasoning && (
        // Обёртка-класс нужна, чтобы задать фон/цвет нативным <option>: на ПК (webview Telegram
        // Desktop) попап выпадашки рисует Chromium системно-белым, и светлый текст на нём не виден.
        <div className="preset-select">
          <Select
            header="Уровень рассуждения"
            value={reasoningEffort}
            onChange={(e) => onReasoningEffort(e.target.value as ReasoningEffort)}
          >
            {REASONING_EFFORTS.map((effort) => (
              <option key={effort} value={effort}>
                {REASONING_EFFORT_LABELS[effort]}
              </option>
            ))}
          </Select>
        </div>
      )}
    </>
  );
}
