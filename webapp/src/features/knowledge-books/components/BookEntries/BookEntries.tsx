import { Button, Text, ThemeIcon } from "@mantine/core";
import { FileText, Plus } from "lucide-react";
import { ListRow } from "../../../../shared/components/ListCard";
import { OrderArrows } from "../../../../shared/components/OrderArrows";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { CharacterAvatar } from "../../../characters";
import { PersonaAvatar } from "../../../personas";
import { MAX_ENTRIES_PER_BOOK, type Entry } from "../../types/book";
import { entryDescription, entryTitle } from "../../lib/entryLabels";
import styles from "./BookEntries.module.css";

interface BookEntriesProps {
  entries: Entry[];
  onOpen: (entry: Entry) => void;
  onAdd: () => void;
  /** Сдвиг записи на одну позицию: порядок — очередь вставки записей в промпт истории. */
  onMove: (index: number, dir: -1 | 1) => void;
}

/** Слева в строке: аватар персонажа/персоны или значок текста — одного размера, чтобы строки не прыгали. */
function EntryLeading({ entry }: { entry: Entry }) {
  if (entry.characterId != null) {
    return <CharacterAvatar id={entry.characterId} hasImage={entry.characterHasImage} name={entry.characterName ?? ""} />;
  }
  if (entry.personaId != null) {
    return <PersonaAvatar id={entry.personaId} hasImage={entry.personaHasImage} name={entry.personaName ?? ""} />;
  }
  return (
    <ThemeIcon size={40} radius="xl" variant="light" color="gray">
      <FileText size={20} />
    </ThemeIcon>
  );
}

/** Карточка записей книги: строки со стрелками порядка, добавление с учётом лимита. */
export function BookEntries({ entries, onOpen, onAdd, onMove }: BookEntriesProps) {
  const atLimit = entries.length >= MAX_ENTRIES_PER_BOOK;

  return (
    <SettingsCard
      title={`Записи · ${entries.length} из ${MAX_ENTRIES_PER_BOOK}`}
      description="Что рассказчик знает о мире. Порядок — очередь, в которой записи попадают в запрос."
    >
      {entries.length > 0 ? (
        <div className={styles.rows}>
          {entries.map((e, index) => (
            <ListRow
              key={e.id}
              index={index}
              // Стабильный key + layout — при перестановке строки плавно переезжают, а не перескакивают.
              layout
              leading={<EntryLeading entry={e} />}
              title={entryTitle(e)}
              description={entryDescription(e)}
              onClick={() => onOpen(e)}
              trailing={
                <OrderArrows index={index} count={entries.length} label={entryTitle(e)} onMove={(dir) => onMove(index, dir)} />
              }
            />
          ))}
        </div>
      ) : (
        <Text size="sm" c="dimmed">
          Пока нет записей. Добавьте персонажа, персону или факт о мире.
        </Text>
      )}
      <Button variant="light" leftSection={<Plus size={18} />} disabled={atLimit} onClick={onAdd}>
        Добавить запись
      </Button>
    </SettingsCard>
  );
}
