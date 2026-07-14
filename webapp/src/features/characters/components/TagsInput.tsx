import { Cell, type CellProps, Multiselect, type MultiselectProps } from "@telegram-apps/telegram-ui";
import { useMemo } from "react";
import { useTagOptions } from "../hooks/useTagOptions";

/** Опция чипа/подсказки Multiselect (упрощённо — типа MultiselectOption из tg-ui, которого нет в паблик-экспорте). */
interface TagValue {
  value: string;
  label: string;
}

interface TagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Ввод тегов на базе tg-ui Multiselect: чипы + дропдаун подсказок из уже использованных тегов
 * (счётчик — через renderOption) + свободное создание нового тега (creatable). Навигация
 * клавиатурой/мышью, автозакрытие по клику вне поля и исключение уже выбранных тегов из подсказок
 * (selectedBehavior="hide") — всё встроено в Multiselect, свою обвязку поверх не пишем.
 */
export function TagsInput({ tags, onChange }: TagsInputProps) {
  const options = useTagOptions();
  const countByTag = useMemo(() => new Map(options.map((o) => [o.value, o.count])), [options]);
  const value = useMemo<TagValue[]>(() => tags.map((tag) => ({ value: tag, label: tag })), [tags]);

  // renderOption вызывается как обычная функция (не JSX-компонент) — тип MultiselectProps
  // в tg-ui неточен (объявлен как ForwardRefExoticComponent), поэтому кастуем на выходе.
  const renderOption = (props: CellProps) => (
    <Cell {...props} after={countByTag.get(String(props.children))} />
  );

  return (
    <Multiselect
      header="Теги"
      placeholder="Добавьте тег и нажмите Enter"
      options={options}
      value={value}
      onChange={(next) => onChange(next.map((option) => String(option.value)))}
      creatable="Добавить тег"
      selectedBehavior="hide"
      renderOption={renderOption as MultiselectProps["renderOption"]}
    />
  );
}
