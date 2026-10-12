import { Button, Stack } from "@mantine/core";
import { useState } from "react";
import { DeleteButton } from "../../../../shared/components/DeleteButton";
import { confirmAction } from "../../../../shared/telegram/confirm";
import { useUnsavedChangesGuard } from "../../../../shared/telegram/useUnsavedChangesGuard";
import { useToast } from "../../../../shared/toast";
import { createEntry, removeEntry, updateEntry } from "../../api/books-api";
import { depthOf } from "../../lib/entryReference";
import type { Entry, EntryActivation, EntryInput } from "../../types/book";
import { DEFAULT_KEYWORD_DEPTH } from "../../types/book";
import { ActivationCard } from "./ActivationCard";
import { ContentCard } from "./ContentCard";
import { useEntryReference, type EntryMode } from "./useEntryReference";

interface EntryEditorProps {
  bookId: number;
  /** undefined → создание новой записи. */
  initial?: Entry;
  /** После сохранения или удаления — экран возвращается к книге. */
  onDone: () => void;
}

/**
 * Редактор одной записи книги знаний. Три вида: «персонаж»/«персона» (ссылка на карточку) или
 * «свободный текст». Активация: always_on (всегда в промпте) или keyword (дополнительно к enabled —
 * только если одно из триггер-слов встретилось среди последних keywordDepth сообщений истории).
 * name обязателен — в промпте им оборачивается текст записи: <name>…</name> (getActiveEntriesForPrompt).
 */
export function EntryEditor({ bookId, initial, onDone }: EntryEditorProps) {
  const { showToast } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [mode, setMode] = useState<EntryMode>(
    initial?.characterId != null ? "character" : initial?.personaId != null ? "persona" : "free",
  );
  const [characterId, setCharacterId] = useState<number | null>(initial?.characterId ?? null);
  const [personaId, setPersonaId] = useState<number | null>(initial?.personaId ?? null);
  const [content, setContent] = useState(initial?.content ?? "");
  const [alias, setAlias] = useState(initial?.alias ?? "");
  const [activation, setActivation] = useState<EntryActivation>(initial?.activation ?? "always_on");
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? []);
  const [keywordDepth, setKeywordDepth] = useState<number | string>(initial?.keywordDepth ?? DEFAULT_KEYWORD_DEPTH);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [submitting, setSubmitting] = useState(false);

  const ref = useEntryReference(mode, characterId, personaId, initial);

  // То, что уйдёт на сервер: поля неактивного вида обнуляются.
  const input: EntryInput = {
    name: name.trim(),
    enabled,
    activation,
    characterId: mode === "character" ? characterId : null,
    personaId: mode === "persona" ? personaId : null,
    alias: mode === "free" ? "" : alias.trim(),
    content: mode === "free" ? content.trim() : "",
    keywords: activation === "keyword" ? keywords.map((k) => k.trim()).filter(Boolean) : [],
    keywordDepth: depthOf(keywordDepth),
  };

  // Снимок исходной записи в том же виде — для предупреждения о несохранённых правках при «Назад».
  const [baseline] = useState(() => JSON.stringify(input));
  const dirty = JSON.stringify(input) !== baseline;
  useUnsavedChangesGuard(dirty && !submitting);

  const valid =
    input.name.length > 0 &&
    ref.referenceReady &&
    (mode === "free" ? input.content.length > 0 : !ref.aliasRequired || input.alias.length > 0) &&
    // Запись «по ключу» без триггер-слов никогда не сработает — требуем хотя бы одно.
    (activation !== "keyword" || input.keywords.length > 0);

  const handleSave = () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    const op = initial ? updateEntry(bookId, initial.id, input) : createEntry(bookId, input);
    op.then(onDone).catch(() => {
      setSubmitting(false);
      showToast({ type: "error", message: "Не удалось сохранить запись" });
    });
  };

  const handleDelete = async () => {
    if (!initial || submitting) return;
    const confirmed = await confirmAction("Удалить запись? Это действие необратимо.", {
      title: "Удаление записи",
    });
    if (!confirmed) return;
    setSubmitting(true);
    removeEntry(bookId, initial.id)
      .then(onDone)
      .catch(() => {
        setSubmitting(false);
        showToast({ type: "error", message: "Не удалось удалить запись" });
      });
  };

  return (
    <Stack gap="lg">
      <ContentCard
        name={name}
        mode={mode}
        content={content}
        alias={alias}
        characters={ref.characters}
        personas={ref.personas}
        selectedCharacter={ref.selectedCharacter}
        selectedPersona={ref.selectedPersona}
        showAlias={ref.showAlias}
        onName={setName}
        onMode={setMode}
        onCharacter={setCharacterId}
        onPersona={setPersonaId}
        onContent={setContent}
        onAlias={setAlias}
      />

      <ActivationCard
        enabled={enabled}
        activation={activation}
        keywords={keywords}
        keywordDepth={keywordDepth}
        onEnabled={setEnabled}
        onActivation={setActivation}
        onKeywords={setKeywords}
        onKeywordDepth={setKeywordDepth}
      />

      <Stack gap="sm">
        <Button fullWidth disabled={!valid} loading={submitting} onClick={handleSave}>
          {initial ? "Сохранить" : "Добавить запись"}
        </Button>
        {initial && (
          <DeleteButton onClick={handleDelete} disabled={submitting}>
            Удалить запись
          </DeleteButton>
        )}
      </Stack>
    </Stack>
  );
}
