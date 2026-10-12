import { Button } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { CollapsibleCard } from "../../../../shared/components/CollapsibleCard";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import { MAX_CARD_CATEGORIES } from "../../types/card";
import type { CardCategory } from "../../types/card";
import { CategoryRow } from "./CategoryRow";
import styles from "./CategoryList.module.css";

interface CategoryListProps {
  categories: CardCategory[];
  onChange: (categories: CardCategory[]) => void;
}

/**
 * Карточка «Структура»: категории (название, пример, вкл/выкл) с добавлением и удалением. Порядок
 * массива = порядок сборки <example> и генерации блоков (assembleCardBlockPrompt на сервере); сама
 * перестановка — в карточке «Порядок полей» (CategoryOrderList). Свёрнута по умолчанию: правится
 * реже промптов.
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
    <CollapsibleCard
      title="Структура"
      description={`Категории карточки (${categories.length} из ${MAX_CARD_CATEGORIES}): что генерирует ИИ и в каком формате.`}
    >
      {/* Категории — один ребёнок колонки карточки: появление/удаление анимируется высотой, а
          разделитель между ними рисует CSS (.item + .item), а не gap. */}
      <div>
        <AnimatePresence initial={false}>
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              className={styles.item}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={MOTION_TRANSITION}
            >
              <CategoryRow
                category={category}
                onChange={(next) => updateAt(index, next)}
                onRemove={() => removeAt(index)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Button
        variant="light"
        leftSection={<Plus size={18} />}
        disabled={categories.length >= MAX_CARD_CATEGORIES}
        onClick={add}
      >
        Добавить категорию
      </Button>
    </CollapsibleCard>
  );
}
