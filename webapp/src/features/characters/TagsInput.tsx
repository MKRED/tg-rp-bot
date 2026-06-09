import { Chip, Input } from "@telegram-apps/telegram-ui";
import { type KeyboardEvent, useState } from "react";

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

  const addTag = () => {
    const tag = draft.trim();
    if (!tag) return;
    if (!tags.includes(tag)) onChange([...tags, tag]);
    setDraft("");
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
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
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
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
