import { Button, Input } from "@telegram-apps/telegram-ui";
import { useMemo, useState } from "react";
import { DeleteButton } from "../../../../shared/components/DeleteButton";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { useUnsavedChangesGuard } from "../../../../shared/telegram/useUnsavedChangesGuard";
import { hasUnsavedChanges, normalizeCardDraft } from "../../lib/formDirty";
import { DEFAULT_CARD_CATEGORIES, DEFAULT_CARD_PROMPT } from "../../types/card";
import type { CardCategory, CardInput, CardPresetOption } from "../../types/card";
import { CategoryList } from "./CategoryList";
import { GenerationSection } from "./GenerationSection";
import { PresetPicker } from "./PresetPicker";

interface CardFormProps {
  /** Начальные значения (режим редактирования); отсутствуют — режим создания. */
  initial?: CardInput;
  /** id уже сохранённой карточки — без него GenerationSection недоступна (роут требует id). */
  cardId?: number;
  presets: CardPresetOption[];
  presetsLoading: boolean;
  submitting: boolean;
  /** Промис нужен, чтобы форма знала об успехе и сбросила «грязный» снапшот — окно после
   * сохранения не закрывается, а показывает уведомление (см. CardEditPage). */
  onSubmit: (input: CardInput) => Promise<void>;
  /** Удаление доступно только при редактировании. */
  onDelete?: () => void;
}

/** Форма создания/редактирования карточки «Мастерской»: имя, промпт, структура, пресет, генерация блоков. */
export function CardForm({
  initial,
  cardId,
  presets,
  presetsLoading,
  submitting,
  onSubmit,
  onDelete,
}: CardFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? DEFAULT_CARD_PROMPT);
  const [categories, setCategories] = useState<CardCategory[]>(
    initial?.categories ?? DEFAULT_CARD_CATEGORIES,
  );
  const [presetId, setPresetId] = useState<number | null>(initial?.presetId ?? null);

  // Снапшот последних сохранённых значений — база для «грязного» статуса (см. CharacterForm).
  const [baseline, setBaseline] = useState<CardInput>(() =>
    normalizeCardDraft({
      name: initial?.name ?? "",
      prompt: initial?.prompt ?? DEFAULT_CARD_PROMPT,
      categories: initial?.categories ?? DEFAULT_CARD_CATEGORIES,
      presetId: initial?.presetId ?? null,
    }),
  );
  const isDirty = useMemo(
    () => hasUnsavedChanges({ name, prompt, categories, presetId }, baseline),
    [name, prompt, categories, presetId, baseline],
  );
  useUnsavedChangesGuard(isDirty);

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const payload = normalizeCardDraft({ name, prompt, categories, presetId });
    try {
      await onSubmit(payload);
      setBaseline(payload);
    } catch {
      // Ошибку показывает CardEditPage (тост) — здесь просто не сбрасываем baseline.
    }
  };

  // Генерация блока уже сохранена на сервере (см. generateNextBlock) — синхронизируем и локальный
  // стейт, и baseline той же точечной правкой, иначе guard посчитал бы уже сохранённый текст
  // «несохранённым изменением». Мержим по categoryId (а не заменяем весь массив с сервера), чтобы
  // не затереть параллельные несохранённые правки других категорий.
  const handleGenerated = (categoryId: string, content: string) => {
    const next = categories.map((c) => (c.id === categoryId ? { ...c, content } : c));
    setCategories(next);
    setBaseline((b) => ({
      ...b,
      categories: b.categories.map((c) => (c.id === categoryId ? { ...c, content } : c)),
    }));
  };

  return (
    <div className="card-form">
      <Input
        header="Название"
        placeholder="Название карточки"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <PromptEditorField
        header="Основной промпт"
        hint="Общая инструкция для ИИ. Можно вставить {{example}} — на его место встанет структура категорий; если не вставить, она допишется в конец."
        placeholder={DEFAULT_CARD_PROMPT}
        value={prompt}
        previewLines={6}
        onChange={setPrompt}
      />

      <PresetPicker
        presets={presets}
        loading={presetsLoading}
        presetId={presetId}
        onChange={setPresetId}
      />

      <div className="card-form__section-title">Структура карточки</div>
      <CategoryList categories={categories} onChange={setCategories} />

      <div className="card-form__section-title">Генерация</div>
      <GenerationSection
        cardId={cardId}
        categories={categories}
        presetId={presetId}
        formDirty={isDirty}
        onContentChange={setCategories}
        onGenerated={handleGenerated}
      />

      <div className="card-form__actions">
        {isDirty && !submitting && <span className="card-form__unsaved">Есть несохранённые изменения</span>}
        <Button size="l" stretched disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </Button>
        {onDelete && (
          <DeleteButton disabled={submitting} onClick={onDelete}>
            Удалить карточку
          </DeleteButton>
        )}
      </div>
    </div>
  );
}
