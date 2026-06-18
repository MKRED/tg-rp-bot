import { Chip, Input } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { type ChangeEvent, type KeyboardEvent, useState } from "react";
import { useTagSuggestions } from "../hooks/useTagSuggestions";
import { TagSuggestions } from "./TagSuggestions";

interface TagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Ввод тегов: поле + чипы с удалением + подсказки из уже использованных тегов (со счётчиком).
 * Готового tag-input в telegram-ui нет, поэтому свой. Тег добавляется по Enter/запятой, кликом
 * по подсказке или выбором подсвеченной стрелками подсказки; дубликаты и пустые игнорируются.
 */
export function TagsInput({ tags, onChange }: TagsInputProps) {
  const [draft, setDraft] = useState("");
  // Открыт ли список подсказок (по фокусу) и индекс подсвеченной строки (-1 — нет подсветки).
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useTagSuggestions(tags, draft);
  const showSuggestions = open && suggestions.length > 0;

  /** Добавляет уже готовые (непустые, не-дубликаты) теги к текущему списку. */
  const appendTags = (incoming: string[]) => {
    const merged = [...tags];
    for (const raw of incoming) {
      const tag = raw.trim();
      if (tag && !merged.includes(tag)) merged.push(tag);
    }
    if (merged.length !== tags.length) onChange(merged);
  };

  const addDraft = () => {
    appendTags([draft]);
    setDraft("");
  };

  /** Выбор подсказки: добавить тег, очистить ввод, сбросить подсветку (поле остаётся в фокусе). */
  const pickSuggestion = (tag: string) => {
    appendTags([tag]);
    setDraft("");
    setActiveIndex(-1);
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  /**
   * Разделитель (запятая или перевод строки) коммитит тег прямо в onChange. На мобильных
   * клавиша «ввод» часто не даёт ловимого keydown «Enter», а вставляет в значение `\n` —
   * поэтому ориентируемся на сам символ-разделитель, а не на нажатие клавиши.
   */
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setActiveIndex(-1); // список перефильтровался — снимаем подсветку
    if (value.includes(",") || value.includes("\n")) {
      const parts = value.split(/[,\n]/);
      const last = parts.pop() ?? ""; // хвост после последнего разделителя остаётся в поле
      appendTags(parts);
      setDraft(last);
    } else {
      setDraft(value);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && showSuggestions) {
      // вниз по списку (с края — на первый элемент)
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && showSuggestions) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter") {
      // Enter: есть подсвеченная подсказка → выбираем её; иначе коммитим черновик.
      e.preventDefault();
      const active = showSuggestions && activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (active) pickSuggestion(active.tag);
      else addDraft();
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      // пустой ввод + Backspace → убираем последний тег
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="char-tags">
      <div className="char-tags__field">
        <Input
          header="Теги"
          placeholder="Добавьте тег и нажмите Enter"
          value={draft}
          enterKeyHint="done"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // клик по подсказке гасит blur (onMouseDown+preventDefault), сюда попадаем при уходе
            // фокуса в сторону — коммитим черновик и закрываем список.
            addDraft();
            setOpen(false);
            setActiveIndex(-1);
          }}
        />
        <AnimatePresence>
          {showSuggestions && (
            <TagSuggestions
              items={suggestions}
              activeIndex={activeIndex}
              onPick={pickSuggestion}
              onHover={setActiveIndex}
            />
          )}
        </AnimatePresence>
      </div>

      {tags.length > 0 && (
        <div className="char-tags__list">
          <AnimatePresence initial={false}>
            {tags.map((tag) => (
              <motion.div
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <Chip
                  mode="outline"
                  after={<span aria-hidden>✕</span>}
                  onClick={() => removeTag(tag)}
                >
                  {tag}
                </Chip>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
