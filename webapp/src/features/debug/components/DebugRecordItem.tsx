import { Accordion, Code, Group, Text } from "@mantine/core";
import { CircleCheck, CircleX } from "lucide-react";
import { elideRequest, unescapeNewlines } from "../lib/elide";
import type { LlmDebugRecord } from "../types/debug";
import styles from "./DebugLlmView.module.css";

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
 * Одна запись перехвата (пункт Accordion). Свёрнута — шапка (тип, модель, статус, время). Развёрнута —
 * RAW-тело запроса (с усечённым по headK/tailK messages[]) и ответ. Усечение применяется на показе.
 */
export function DebugRecordItem({ record, headK, tailK }: { record: LlmDebugRecord; headK: number; tailK: number }) {
  const { response: r } = record;

  // Статус: ok — зелёная галочка; ошибка — красный крестик с кодом (если был HTTP-статус) в подписи.
  const statusTitle = r.ok ? "ok" : r.status ? `HTTP ${r.status}` : "ошибка";

  const requestJson = unescapeNewlines(JSON.stringify(elideRequest(record.request, headK, tailK), null, 2));

  // tools в RAW-теле значит лишь то, что инструмент был ПРЕДЛОЖЕН — tool-loop карточек кладёт его,
  // пока не исчерпан бюджет раундов, даже если модель в итоге не позвала поиск. Поэтому смотрим
  // на факт использования: либо сама модель в этом раунде запросила инструмент (response.toolCalls),
  // либо в history уже лежит результат поиска (role: "tool") из более раннего раунда цикла.
  const requestMessages = record.request.messages;
  const hasSearchResultInHistory =
    Array.isArray(requestMessages) && requestMessages.some((m) => (m as { role?: string })?.role === "tool");
  const usedWebSearch = Boolean(r.toolCalls?.length) || hasSearchResultInHistory;

  // content и tool_calls не взаимоисключающие — DeepSeek может отдать короткую преамбулу текстом
  // и tool_calls в одном ответе, || скрыл бы вызов инструмента, раз текст уже непустой.
  const responseText = r.ok
    ? [r.content, r.toolCalls?.length ? JSON.stringify(r.toolCalls, null, 2) : null].filter(Boolean).join("\n\n")
    : (r.error ?? "(без текста)");

  return (
    <Accordion.Item value={String(record.id)}>
      <Accordion.Control>
        <Group wrap="nowrap" gap="sm">
          <div className={styles.summary}>
            <Text fw={500}>{LABEL_TEXT[record.label]}</Text>
            <Text size="sm" c="dimmed" truncate>
              {usedWebSearch ? `${record.model} · веб-поиск` : record.model}
              {!r.ok && ` · ${statusTitle}`}
            </Text>
          </div>
          <Text size="xs" c="dimmed">
            {fmtTime(record.at)}
          </Text>
          {r.ok ? (
            <CircleCheck size={18} color="var(--mantine-color-green-text)" aria-label={statusTitle} />
          ) : (
            <CircleX size={18} color="var(--mantine-color-red-text)" aria-label={statusTitle} />
          )}
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Text size="xs" c="dimmed">
          {record.provider} · {record.streaming ? "stream" : "single"} · {record.durationMs} мс
          {r.usage ? ` · ${r.usage.promptTokens}+${r.usage.completionTokens} ток.` : ""}
        </Text>

        <Text size="xs" fw={600} tt="uppercase" c="dimmed" className={styles.sectionTitle}>
          Запрос
        </Text>
        <Code block className={styles.code}>
          {requestJson}
        </Code>

        <Text size="xs" fw={600} tt="uppercase" c="dimmed" className={styles.sectionTitle}>
          Ответ
        </Text>
        <Code block className={styles.code}>
          {responseText}
        </Code>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
