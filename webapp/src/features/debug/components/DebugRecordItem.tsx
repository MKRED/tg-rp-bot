import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { elideRequest } from "../lib/elide";
import type { LlmDebugRecord } from "../types/debug";

/** Человекочитаемые подписи ярлыков типа вызова. */
const LABEL_TEXT: Record<LlmDebugRecord["label"], string> = {
  rp: "RP-чат",
  impersonate: "Impersonate",
  narrator: "Нарратор",
  translate: "Перевод",
  compact: "Сжатие",
  other: "Другое",
};

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU");

/**
 * Одна запись перехвата. Свёрнута — шапка (тип, модель, статус, время). Развёрнута — RAW-тело
 * запроса (с усечённым по headK/tailK messages[]) и ответ. Усечение применяется на показе.
 */
export function DebugRecordItem({
  record,
  headK,
  tailK,
}: {
  record: LlmDebugRecord;
  headK: number;
  tailK: number;
}) {
  const [open, setOpen] = useState(false);
  const { response: r } = record;

  // Статус: ok зелёный; ошибка красная с кодом (если был HTTP-статус).
  const statusText = r.ok ? "ok" : r.status ? `HTTP ${r.status}` : "ошибка";
  const statusColor = r.ok ? "#2e7d32" : "#e53935";

  const requestJson = JSON.stringify(elideRequest(record.request, headK, tailK), null, 2);

  return (
    <div className="debug-record">
      <button type="button" className="debug-record__head" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="debug-record__label">{LABEL_TEXT[record.label]}</span>
        <span className="debug-record__model">{record.model}</span>
        <span className="debug-record__status" style={{ color: statusColor }}>
          {statusText}
        </span>
        <span className="debug-record__time">{fmtTime(record.at)}</span>
      </button>

      {open && (
        <div className="debug-record__body">
          <div className="debug-record__meta">
            {record.provider} · {record.streaming ? "stream" : "single"} · {record.durationMs} мс
            {r.usage ? ` · ${r.usage.promptTokens}+${r.usage.completionTokens} ток.` : ""}
          </div>

          <div className="debug-record__section-title">Запрос</div>
          <pre className="debug-record__pre">{requestJson}</pre>

          <div className="debug-record__section-title">Ответ</div>
          <pre className="debug-record__pre">
            {r.ok ? (r.content ?? "") : (r.error ?? "(без текста)")}
          </pre>
        </div>
      )}
    </div>
  );
}
