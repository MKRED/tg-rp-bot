import { Multiselect } from "@telegram-apps/telegram-ui";
import { useMemo } from "react";

interface TagValue {
  value: string;
  label: string;
}

interface KeywordsInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}

/**
 * Ввод триггер-слов записи книги знаний на базе tg-ui Multiselect: чипы + свободное создание
 * (creatable), без источника подсказок (в отличие от TagsInput тегов персонажей — общего
 * справочника триггер-слов между записями нет).
 */
export function KeywordsInput({ keywords, onChange }: KeywordsInputProps) {
  const value = useMemo<TagValue[]>(() => keywords.map((k) => ({ value: k, label: k })), [keywords]);

  return (
    <Multiselect
      header="Триггер-слова"
      placeholder="Слово и Enter"
      options={[]}
      value={value}
      onChange={(next) => onChange(next.map((option) => String(option.value)))}
      creatable="Добавить слово"
      selectedBehavior="hide"
    />
  );
}
