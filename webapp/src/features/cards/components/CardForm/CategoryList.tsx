import { Button, Divider } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { SectionActions } from "../../../../shared/components/SectionActions";
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
 * (см. assembleCardBlockPrompt на сервере) — сама перестановка живёт в отдельной секции
 * (CategoryOrderList), эта отвечает только за содержимое категорий.
 *
 * Все категории — в одной общей карточке (фон/скругления даёт внешняя Section в CardForm), между
 * ними — Divider (tgui). Section сама вставляет Divider между прямыми детьми, но не видит сквозь
 * AnimatePresence (см. docs/telegram-ui.md, 1.4.2) — категории лежат внутри неё ради exit-анимации
 * при удалении, поэтому разделители ставим вручную по индексу, а не полагаемся на автоматику Section.
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
    <>
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
            {/* Разделитель — leading, не trailing: индекс пересчитывается на каждый рендер, так что
                после удаления категории он остаётся ровно между оставшимися блоками, без "хвоста". */}
            {index > 0 && <Divider />}
            <CategoryRow
              category={category}
              onChange={(next) => updateAt(index, next)}
              onRemove={() => removeAt(index)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      {categories.length > 0 && <Divider />}
      <SectionActions>
        <Button
          size="s"
          mode="outline"
          className="card-categories__add"
          disabled={categories.length >= MAX_CARD_CATEGORIES}
          onClick={add}
        >
          + Добавить категорию
        </Button>
      </SectionActions>
    </>
  );
}
