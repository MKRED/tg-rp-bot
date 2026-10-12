import { TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { useToast } from "../../../../shared/toast";
import { renameChat } from "../../api/chats-api";

interface ChatTitleCardProps {
  chatId: number;
  /** Сохранённое название; null — показываем имя персонажа. */
  title: string | null;
  characterName: string;
  onSaved: (title: string | null) => void;
}

/** Название чата: правится свободно, сохраняется при уходе с поля. Пусто — имя персонажа. */
export function ChatTitleCard({ chatId, title, characterName, onSaved }: ChatTitleCardProps) {
  const { showToast } = useToast();
  const [value, setValue] = useState(title ?? "");

  // Подхватываем сохранённое название, когда чат загрузился или переименован.
  useEffect(() => {
    setValue(title ?? "");
  }, [title]);

  const save = async () => {
    const next = value.trim();
    if (next === (title ?? "")) {
      setValue(next); // без изменений — не дёргаем API, но пробелы по краям убираем
      return;
    }
    try {
      const saved = await renameChat(chatId, next);
      onSaved(saved);
      setValue(saved ?? "");
    } catch (err) {
      // Возвращаем поле к сохранённому значению, чтобы оно не врало.
      console.error("Failed to rename chat", err);
      showToast({ type: "error", message: "Не удалось переименовать чат" });
      setValue(title ?? "");
    }
  };

  return (
    <SettingsCard title="Название">
      <TextInput
        aria-label="Название чата"
        description="Оставьте пустым, чтобы показывать имя персонажа"
        placeholder={characterName}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onBlur={save}
      />
    </SettingsCard>
  );
}
