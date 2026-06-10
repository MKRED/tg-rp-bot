import { Chip, Input } from "@telegram-apps/telegram-ui";
import { type ChangeEvent, type KeyboardEvent, useState } from "react";

interface TagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Ввод тегов: поле + чипы с удалением. Готового tag-input в telegram-ui нет, поэтому свой.
 * Тег добавляется по Enter или запятой; дубликаты и пустые игнорируются.
 */
export function TagsInput({ tags, onChange }: TagsInputProps) {
  const [draft, setDraft] = useState("");

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

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  /**
   * Разделитель (запятая или перевод строки) коммитит тег прямо в onChange. На мобильных
   * клавиша «ввод» часто не даёт ловимого keydown «Enter», а вставляет в значение `\n` —
   * поэтому ориентируемся на сам символ-разделитель, а не на нажатие клавиши.
   */
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
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
    if (e.key === "Enter") {
      // на десктопе Enter не меняет value (нет символа) — добавляем тег здесь
      e.preventDefault();
      addDraft();
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      // пустой ввод + Backspace → убираем последний тег
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="char-tags">
      <Input
        header="Теги"
        placeholder="Добавьте тег и нажмите Enter"
        value={draft}
        enterKeyHint="done"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={addDraft}
      />
      {tags.length > 0 && (
        <div className="char-tags__list">
          {tags.map((tag) => (
            <Chip
              key={tag}
              mode="outline"
              after={<span aria-hidden>✕</span>}
              onClick={() => removeTag(tag)}
            >
              {tag}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
