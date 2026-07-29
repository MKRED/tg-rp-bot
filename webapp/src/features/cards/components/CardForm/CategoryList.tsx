import { Button } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { MAX_CARD_CATEGORIES } from "../../types/card";
import type { CardCategory } from "../../types/card";
import { CategoryRow } from "./CategoryRow";

interface CategoryListProps {
  categories: CardCategory[];
  onChange: (categories: CardCategory[]) => void;
}

/**
 * Редактор структуры карточки: список категорий (заголовок + пример + вкл/выкл) с добавлением
 * и удалением. Порядок = порядок элементов массива = порядок сборки <example> и генерации блоков
 * (см. assembleCardBlockPrompt на сервере) — переупорядочивание пока не нужно (не запрошено).
 */
export function CategoryList({ categories, onChange }: CategoryListProps) {
  const updateAt = (index: number, next: CardCategory) => {
    onChange(categories.map((c, i) => (i === index ? next : c)));
  };

  const removeAt = (index: number) => {
    onChange(categories.filter((_, i) => i !== index));
  };

  const add = () => {
    if (categories.length >= MAX_CARD_CATEGORIES) return;
    onChange([
      ...categories,
      { id: `custom-${crypto.randomUUID()}`, title: "", description: "", content: "", enabled: true },
    ]);
  };

  return (
    <div className="card-categories">
      <AnimatePresence initial={false}>
        {categories.map((category, index) => (
          <motion.div
            key={category.id}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <CategoryRow
              category={category}
              onChange={(next) => updateAt(index, next)}
              onRemove={() => removeAt(index)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      <Button
        size="s"
        mode="outline"
        className="card-categories__add"
        disabled={categories.length >= MAX_CARD_CATEGORIES}
        onClick={add}
      >
        + Добавить категорию
      </Button>
    </div>
  );
}
