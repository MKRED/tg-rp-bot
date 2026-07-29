import { IconButton, Input, Switch } from "@telegram-apps/telegram-ui";
import { Trash2 } from "lucide-react";
import { ExpandableTextarea } from "../../../../shared/components/ExpandableTextarea";
import type { CardCategory } from "../../types/card";

interface CategoryRowProps {
  category: CardCategory;
  onChange: (next: CardCategory) => void;
  onRemove: () => void;
}

/**
 * Один блок структуры карточки: заголовок категории (title), пример формата для ИИ (description),
 * включена ли категория в <example>/генерацию (enabled), удаление. Сгенерированный/отредактированный
 * текст (content) сюда не входит — это GenerationSection, отдельная секция формы.
 */
export function CategoryRow({ category, onChange, onRemove }: CategoryRowProps) {
  return (
    <div className="card-category">
      <div className="card-category__header">
        <Input
          className="card-category__title"
          placeholder="Название категории"
          value={category.title}
          onChange={(e) => onChange({ ...category, title: e.target.value })}
        />
        <Switch
          checked={category.enabled}
          onChange={() => onChange({ ...category, enabled: !category.enabled })}
        />
        <IconButton size="s" mode="plain" aria-label="Удалить категорию" onClick={onRemove}>
          <Trash2 size={18} />
        </IconButton>
      </div>
      <ExpandableTextarea
        placeholder="Пример формата для этой категории (что должен сгенерировать ИИ)…"
        value={category.description}
        rows={3}
        onChange={(e) => onChange({ ...category, description: e.target.value })}
      />
    </div>
  );
}
