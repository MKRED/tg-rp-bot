import { TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { useToast } from "../../toast";
import { SettingsCard } from "../SettingsCard";

interface TitleCardProps {
  /** Сохранённое название; null — вместо него показывается имя по умолчанию (placeholder). */
  title: string | null;
  /** Имя по умолчанию: персонаж чата, книга истории. */
  placeholder: string;
  description: string;
  ariaLabel: string;
  /** Сохраняет название (пустая строка — сбросить) и возвращает сохранённое. */
  onRename: (title: string) => Promise<string | null>;
  onSaved?: (title: string | null) => void;
  errorMessage: string;
}

/** Название чата или истории: правится свободно, сохраняется при уходе с поля. */
export function TitleCard({ title, placeholder, description, ariaLabel, onRename, onSaved, errorMessage }: TitleCardProps) {
  const { showToast } = useToast();
  const [saved, setSaved] = useState(title ?? "");
  const [value, setValue] = useState(title ?? "");

  // Подхватываем сохранённое название, когда запись загрузилась или переименована снаружи.
  useEffect(() => {
    setSaved(title ?? "");
    setValue(title ?? "");
  }, [title]);

  const save = async () => {
    const next = value.trim();
    if (next === saved) {
      setValue(next); // без изменений — не дёргаем API, но пробелы по краям убираем
      return;
    }
    try {
      const result = await onRename(next);
      setSaved(result ?? "");
      setValue(result ?? "");
      onSaved?.(result);
    } catch (err) {
      // Возвращаем поле к сохранённому значению, чтобы оно не врало.
      console.error("Failed to rename", err);
      showToast({ type: "error", message: errorMessage });
      setValue(saved);
    }
  };

  return (
    <SettingsCard title="Название">
      <TextInput
        aria-label={ariaLabel}
        description={description}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onBlur={save}
      />
    </SettingsCard>
  );
}
