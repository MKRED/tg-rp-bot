import { CollapsibleCard } from "../../../../shared/components/CollapsibleCard";
import { ListRow } from "../../../../shared/components/ListCard";
import { OrderArrows } from "../../../../shared/components/OrderArrows";
import type { CardCategory } from "../../types/card";
import styles from "./CategoryOrderList.module.css";

interface CategoryOrderListProps {
  categories: CardCategory[];
  onChange: (categories: CardCategory[]) => void;
}

/**
 * Карточка «Порядок полей»: только перестановка категорий (↑/↓, плавный переезд строк). Порядок
 * массива = порядок сборки <example> и очередь генерации блоков (assembleCardBlockPrompt на сервере),
 * поэтому влияет на итоговый промпт.
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
    <CollapsibleCard title="Порядок полей" description="В каком порядке блоки собираются и генерируются.">
      <div className={styles.rows}>
        {categories.map((category, index) => {
          const title = category.title || "Без названия";
          return (
            <ListRow
              key={category.id}
              index={index}
              layout
              title={title}
              description={category.enabled ? undefined : "выключена"}
              trailing={
                <OrderArrows index={index} count={categories.length} label={title} onMove={(dir) => moveAt(index, dir)} />
              }
            />
          );
        })}
      </div>
    </CollapsibleCard>
  );
}
