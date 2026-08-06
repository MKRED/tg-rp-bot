import { IconButton, Input, Switch } from "@telegram-apps/telegram-ui";
import { Trash2 } from "lucide-react";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { confirmAction } from "../../../../shared/telegram/confirm";
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
 *
 * Без своей `Section` — все категории живут в одной общей карточке (фон/скругления даёт внешняя
 * Section в CardForm), а разделители между категориями рисует сам CategoryList. Switch и кнопка
 * удаления — в слоте `after` самого `Input` (FormInput поддерживает before/after из коробки), а не
 * в кастомном flex-контейнере рядом с ним.
 */
export function CategoryRow({ category, onChange, onRemove }: CategoryRowProps) {
  const handleRemove = async () => {
    const confirmed = await confirmAction(
      `Удалить категорию${category.title ? ` «${category.title}»` : ""}?`,
      { title: "Удаление категории" },
    );
    if (confirmed) onRemove();
  };

  return (
    <>
      <Input
        placeholder="Название категории"
        value={category.title}
        onChange={(e) => onChange({ ...category, title: e.target.value })}
        after={
          <div className="card-category__controls">
            <Switch
              checked={category.enabled}
              onChange={() => onChange({ ...category, enabled: !category.enabled })}
            />
            <IconButton size="s" mode="plain" aria-label="Удалить категорию" onClick={handleRemove}>
              <Trash2 size={18} />
            </IconButton>
          </div>
        }
      />
      <PromptEditorField
        header="Пример формата"
        hint="Что должен сгенерировать ИИ для этой категории — задаёт формат и объём ответа."
        placeholder="Пример формата для этой категории…"
        value={category.description}
        previewLines={3}
        onChange={(value) => onChange({ ...category, description: value })}
      />
    </>
  );
}
