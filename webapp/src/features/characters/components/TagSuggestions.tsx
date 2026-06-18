import { motion } from "framer-motion";
import type { TagSuggestion } from "../lib/tagSuggestions";

interface TagSuggestionsProps {
  items: TagSuggestion[];
  /** Индекс подсвеченной строки (навигация стрелками); -1 — нет подсветки. */
  activeIndex: number;
  onPick: (tag: string) => void;
  onHover: (index: number) => void;
}

/**
 * Выпадающий список подсказок тегов под полем ввода. Готового combobox в telegram-ui нет —
 * рисуем свой абсолютно-позиционированный список. Появление/скрытие анимирует родитель через
 * AnimatePresence (height+opacity, паттерн ExpandableSelect); строки появляются stagger-in.
 *
 * Выбор по onMouseDown с preventDefault: иначе blur поля закрыл бы список раньше, чем сработал клик.
 */
export function TagSuggestions({ items, activeIndex, onPick, onHover }: TagSuggestionsProps) {
  return (
    <motion.div
      className="char-tags__suggestions"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ overflow: "hidden" }}
      // уход курсора со списка снимает подсветку, чтобы навигация стрелками не «прыгала»
      // от последней наведённой строки
      onMouseLeave={() => onHover(-1)}
    >
      {items.map((s, i) => (
        <motion.button
          type="button"
          key={s.tag}
          className={`char-tags__suggestion${i === activeIndex ? " char-tags__suggestion--active" : ""}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: "easeOut", delay: i * 0.03 }}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(s.tag);
          }}
          onMouseEnter={() => onHover(i)}
        >
          <span className="char-tags__suggestion-tag">{s.tag}</span>
          <span className="char-tags__suggestion-count">{s.count}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}
