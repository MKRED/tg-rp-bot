import { ActionIcon, Switch, TextInput } from "@mantine/core";
import { Trash2 } from "lucide-react";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { confirmAction } from "../../../../shared/telegram/confirm";
import type { CardCategory } from "../../types/card";
import styles from "./CategoryList.module.css";

interface CategoryRowProps {
  category: CardCategory;
  onChange: (next: CardCategory) => void;
  onRemove: () => void;
}

/**
 * Одна категория структуры карточки: название, включена ли она в <example>/генерацию, удаление и
 * пример формата для ИИ. Сгенерированный текст (content) сюда не входит — это карточка «Генерация».
 */
export function CategoryRow({ category, onChange, onRemove }: CategoryRowProps) {
  const handleRemove = async () => {
    const confirmed = await confirmAction(
      `Удалить категорию${category.title ? ` «${category.title}»` : ""}?`,
      { title: "Удаление категории" },
    );
    if (confirmed) onRemove();
  };

  const name = category.title || "Категория";
  return (
    <div className={styles.row}>
      <div className={styles.head}>
        <TextInput
          className={styles.title}
          placeholder="Название категории"
          aria-label="Название категории"
          value={category.title}
          onChange={(e) => onChange({ ...category, title: e.currentTarget.value })}
        />
        <Switch
          aria-label={`${name}: включена`}
          checked={category.enabled}
          onChange={(e) => onChange({ ...category, enabled: e.currentTarget.checked })}
        />
        <ActionIcon variant="subtle" color="red" size="xl" aria-label={`Удалить категорию «${name}»`} onClick={handleRemove}>
          <Trash2 size={18} />
        </ActionIcon>
      </div>
      <PromptEditorField
        header="Пример формата"
        hint="Что должен сгенерировать ИИ для этой категории — задаёт формат и объём ответа."
        placeholder="Пример формата для этой категории…"
        value={category.description}
        previewLines={3}
        onChange={(value) => onChange({ ...category, description: value })}
      />
    </div>
  );
}
