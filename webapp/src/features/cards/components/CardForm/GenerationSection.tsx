import { Button, Cell, Section, Spinner } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { ApiError } from "../../../../shared/api/client";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { SectionActions } from "../../../../shared/components/SectionActions";
import { useToast } from "../../../../shared/toast";
import { generateNextBlock } from "../../api/cards-api";
import type { CardCategory } from "../../types/card";

const ERROR_MESSAGES: Record<string, string> = {
  preset_required: "Сначала выберите пресет ИИ для генерации",
  nothing_to_generate: "Все включённые блоки уже сгенерированы",
  busy: "Генерация уже идёт, подождите",
  not_found: "Карточка не найдена",
};

interface GenerationSectionProps {
  /** undefined — карточка ещё не сохранена (генерация недоступна, роут требует существующий id). */
  cardId: number | undefined;
  categories: CardCategory[];
  presetId: number | null;
  /**
   * Есть ли несохранённые правки формы (имя/промпт/структура/пресет). Генерация читает prompt и
   * categories с сервера (последнюю СОХРАНЁННУЮ версию), поэтому при isDirty результат разошёлся бы
   * с тем, что видно в форме — блокируем кнопку, а не тихо генерируем по устаревшим данным.
   */
  formDirty: boolean;
  /** Ручная правка content — часть «грязного» состояния формы (требует «Сохранить»). */
  onContentChange: (categories: CardCategory[]) => void;
  /** Результат генерации уже сохранён на сервере — родитель синхронизирует и стейт, и baseline. */
  onGenerated: (categoryId: string, content: string) => void;
}

/**
 * Блоки структуры карточки с результатом генерации: content каждого enabled-блока редактируется
 * вручную (PromptEditorField), а следующий незаполненный — по кнопке, строго один блок за раз,
 * с уже сгенерированными как контекст (см. assembleCardBlockPrompt на сервере).
 */
export function GenerationSection({
  cardId,
  categories,
  presetId,
  formDirty,
  onContentChange,
  onGenerated,
}: GenerationSectionProps) {
  const { showToast } = useToast();
  const [generating, setGenerating] = useState(false);

  const enabled = categories.filter((c) => c.enabled);
  const nextTarget = enabled.find((c) => c.content.trim() === "");

  const updateContent = (id: string, content: string) => {
    onContentChange(categories.map((c) => (c.id === id ? { ...c, content } : c)));
  };

  const handleGenerate = async () => {
    if (cardId === undefined) return;
    setGenerating(true);
    try {
      const { categoryId, content } = await generateNextBlock(cardId);
      onGenerated(categoryId, content);
    } catch (err) {
      const code = err instanceof ApiError ? err.message : "";
      showToast({ type: "error", message: ERROR_MESSAGES[code] ?? (code || "Не удалось сгенерировать блок") });
    } finally {
      setGenerating(false);
    }
  };

  if (enabled.length === 0) {
    return <Cell subtitle="Включите хотя бы одну категорию в структуре, чтобы начать генерацию">Нет категорий для генерации</Cell>;
  }

  return (
    <>
      <Section className="section-blend-inputs">
        {enabled.map((category) => (
          <PromptEditorField
            key={category.id}
            header={category.title || "Без названия"}
            placeholder="Ещё не сгенерирован…"
            value={category.content}
            previewLines={4}
            onChange={(value) => updateContent(category.id, value)}
          />
        ))}
      </Section>

      <SectionActions>
        {cardId === undefined ? (
          <span className="card-generation__hint">Сначала сохраните карточку</span>
        ) : formDirty ? (
          <span className="card-generation__hint">
            Есть несохранённые изменения — сохраните карточку, чтобы генерация использовала актуальные данные
          </span>
        ) : presetId === null ? (
          <span className="card-generation__hint">Выберите пресет ИИ, чтобы включить генерацию</span>
        ) : (
          nextTarget && (
            <Button size="l" stretched disabled={generating} onClick={handleGenerate}>
              {generating ? <Spinner size="s" /> : `Сгенерировать блок «${nextTarget.title || "…"}»`}
            </Button>
          )
        )}
      </SectionActions>
    </>
  );
}
