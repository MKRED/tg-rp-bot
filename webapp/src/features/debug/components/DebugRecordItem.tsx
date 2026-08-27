import { Accordion, Caption, Text } from "@telegram-apps/telegram-ui";
import { CircleCheck, CircleX } from "lucide-react";
import { useState } from "react";
import { elideRequest, unescapeNewlines } from "../lib/elide";
import type { LlmDebugRecord } from "../types/debug";

/** Человекочитаемые подписи ярлыков типа вызова. */
const LABEL_TEXT: Record<LlmDebugRecord["label"], string> = {
  rp: "RP-чат",
  impersonate: "Impersonate",
  narrator: "Нарратор",
  translate: "Перевод",
  compact: "Сжатие",
  cards: "Карточки",
  other: "Другое",
};

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU");

/**
 * Одна запись перехвата, на базе Accordion (tgui). Свёрнута — шапка (тип, модель, статус, время).
 * Развёрнута — RAW-тело запроса (с усечённым по headK/tailK messages[]) и ответ. Усечение
 * применяется на показе.
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

  // Статус: ok зелёный; ошибка красная с кодом (если был HTTP-статус) — иконкой в after.
  const statusTitle = r.ok ? "ok" : r.status ? `HTTP ${r.status}` : "ошибка";
  const statusColor = r.ok ? "#2e7d32" : "#e53935";

  const requestJson = unescapeNewlines(
    JSON.stringify(elideRequest(record.request, headK, tailK), null, 2),
  );

  // tools в RAW-теле значит лишь то, что инструмент был ПРЕДЛОЖЕН — toolLoop кладёт его,
  // пока не исчерпан бюджет раундов, даже если модель в итоге не позвала поиск. Поэтому смотрим
  // на факт использования: либо сама модель в этом раунде запросила инструмент (response.toolCalls),
  // либо в history уже лежит результат поиска (role: "tool") из более раннего раунда цикла.
  const requestMessages = record.request.messages;
  const hasSearchResultInHistory =
    Array.isArray(requestMessages) &&
    requestMessages.some((m) => (m as { role?: string })?.role === "tool");
  const usedWebSearch = Boolean(r.toolCalls?.length) || hasSearchResultInHistory;

  // content и tool_calls не взаимоисключающие — DeepSeek может отдать короткую преамбулу текстом
  // и tool_calls в одном ответе, || скрыл бы вызов инструмента, раз текст уже непустой.
  const responseText = r.ok
    ? [r.content, r.toolCalls?.length ? JSON.stringify(r.toolCalls, null, 2) : null]
        .filter(Boolean)
        .join("\n\n")
    : (r.error ?? "(без текста)");

  return (
    <Accordion expanded={open} onChange={setOpen}>
      <Accordion.Summary
        subtitle={usedWebSearch ? `${record.model} · веб-поиск` : record.model}
        hint={fmtTime(record.at)}
        after={
          r.ok ? (
            <CircleCheck size={18} color={statusColor} aria-label={statusTitle} />
          ) : (
            <CircleX size={18} color={statusColor} aria-label={statusTitle} />
          )
        }
      >
        {LABEL_TEXT[record.label]}
      </Accordion.Summary>
      <Accordion.Content className="debug-record__content">
        <div className="debug-record__body">
          <Caption className="debug-record__meta">
            {record.provider} · {record.streaming ? "stream" : "single"} · {record.durationMs} мс
            {r.usage ? ` · ${r.usage.promptTokens}+${r.usage.completionTokens} ток.` : ""}
          </Caption>

          <Caption weight="2" caps className="debug-record__section-title">
            Запрос
          </Caption>
          <Text Component="pre" className="debug-record__pre">
            {requestJson}
          </Text>

          <Caption weight="2" caps className="debug-record__section-title">
            Ответ
          </Caption>
          <Text Component="pre" className="debug-record__pre">
            {responseText}
          </Text>
        </div>
      </Accordion.Content>
    </Accordion>
  );
}
