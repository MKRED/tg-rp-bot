import { Cell, Divider } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { CardCategory } from "../../types/card";

interface CategoryOrderListProps {
  categories: CardCategory[];
  onChange: (categories: CardCategory[]) => void;
}

/**
 * Порядок категорий структуры карточки: только перестановка (↑/↓), без редактирования содержимого —
 * это делает CategoryList выше. Порядок массива = порядок сборки <example> и очередь генерации блоков
 * (см. assembleCardBlockPrompt на сервере), поэтому влияет на итоговый промпт.
 * Тот же паттерн, что у записей книги знаний (BookEditPage): стрелки в слоте after самого Cell +
 * motion.div layout для плавного FLIP-перехода строк при перестановке. Все строки — в одной общей
 * карточке (фон/скругления даёт внешняя Section в CardForm), между ними — Divider (tgui), как в
 * CategoryList. Вставляется вручную по индексу, а не через автоматику Section: между внешней Section
 * и этими строками стоит Accordion.Content (компонент-обёртка) — Section видит в нём один
 * непрозрачный узел и не может расставить разделители сама (см. docs/telegram-ui.md, 1.4.2).
 */
export function CategoryOrderList({ categories, onChange }: CategoryOrderListProps) {
  const moveAt = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <>
      {categories.map((category, index) => (
        <motion.div key={category.id} layout transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
          {index > 0 && <Divider />}
          <Cell
            hint={!category.enabled ? "выкл." : undefined}
            after={
              // Стрелки — в позиционированном слое над ripple-оверлеем Cell (см. .card-order-btn в
              // cards.css) — иначе он перекрывает статичный after-контент и съедает клики.
              <div className="card-order">
                <button
                  type="button"
                  className="card-order-btn"
                  aria-disabled={index === 0}
                  aria-label="Выше"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveAt(index, -1);
                  }}
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  type="button"
                  className="card-order-btn"
                  aria-disabled={index === categories.length - 1}
                  aria-label="Ниже"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveAt(index, 1);
                  }}
                >
                  <ChevronDown size={18} />
                </button>
              </div>
            }
          >
            {category.title || "Без названия"}
          </Cell>
        </motion.div>
      ))}
    </>
  );
}
