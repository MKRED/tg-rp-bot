import { Button } from "@mantine/core";
import type { CardField } from "@tg-rp-bot/shared";
import { Reorder } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CollapsibleCard } from "../../../../shared/components/CollapsibleCard";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { confirmAction } from "../../../../shared/telegram/confirm";
import { MAX_CARD_CATEGORIES } from "../../types/card";
import { FieldRow } from "./FieldRow";
import styles from "./FieldsEditor.module.css";

interface FieldsEditorProps<T extends CardField> {
  fields: T[];
  onChange: (fields: T[]) => void;
  /** Новое пустое поле: у карточки — с content, у шаблона — без. */
  createField: () => T;
  /** В карточке блок сворачивается (правится реже промптов), в шаблоне — главное содержимое экрана. */
  collapsible?: boolean;
}

/**
 * Блок «Поля» — структура карточки или шаблона одним списком: что генерирует ИИ, в каком формате и
 * в каком порядке (порядок массива = порядок <example> и очередь генерации). Generic по элементу:
 * правки всегда разворачивают исходный объект, поэтому у категории карточки сохраняются content и
 * контекст инструментов, которых редактор не видит.
 */
export function FieldsEditor<T extends CardField>({ fields, onChange, createField, collapsible }: FieldsEditorProps<T>) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const updateAt = (index: number, next: T) => onChange(fields.map((f, i) => (i === index ? next : f)));

  const moveAt = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  const removeAt = async (index: number) => {
    const title = fields[index]!.title;
    const confirmed = await confirmAction(`Удалить поле${title ? ` «${title}»` : ""}?`, { title: "Удаление поля" });
    if (confirmed) onChange(fields.filter((_, i) => i !== index));
  };

  const add = () => {
    if (fields.length >= MAX_CARD_CATEGORIES) return;
    const field = createField();
    onChange([...fields, field]);
    setOpenId(field.id);
    setAddedId(field.id);
  };

  // Reorder сравнивает значения по ссылке — отдаём ему id, а не объекты: объекты пересоздаются на
  // каждой правке, и перетаскивание теряло бы строку.
  const byId = new Map(fields.map((f) => [f.id, f]));
  const handleReorder = (ids: string[]) => onChange(ids.map((id) => byId.get(id)!));

  const body = (
    <>
      <Reorder.Group as="div" axis="y" values={fields.map((f) => f.id)} onReorder={handleReorder} className={styles.list}>
        {fields.map((field, index) => (
          <FieldRow
            key={field.id}
            field={field}
            index={index}
            count={fields.length}
            open={openId === field.id}
            autoFocus={addedId === field.id}
            onToggle={() => setOpenId((id) => (id === field.id ? null : field.id))}
            onChange={(next) => updateAt(index, next)}
            onMove={(dir) => moveAt(index, dir)}
            onRemove={() => void removeAt(index)}
          />
        ))}
      </Reorder.Group>
      <Button variant="light" leftSection={<Plus size={18} />} disabled={fields.length >= MAX_CARD_CATEGORIES} onClick={add}>
        Добавить поле
      </Button>
    </>
  );

  const description = `${fields.length} из ${MAX_CARD_CATEGORIES} · порядок полей = порядок генерации. Тяните за ручку или нажмите на поле.`;
  return collapsible ? (
    <CollapsibleCard title="Поля" description={description}>
      {body}
    </CollapsibleCard>
  ) : (
    <SettingsCard title="Поля" description={description}>
      {body}
    </SettingsCard>
  );
}
