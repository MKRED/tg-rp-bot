import { Button, Stack, Text } from "@mantine/core";
import { Copy, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { DeleteButton } from "../../../../shared/components/DeleteButton";
import { useUnsavedChangesGuard } from "../../../../shared/telegram/useUnsavedChangesGuard";
import { canExportCard } from "../../lib/canExportCard";
import { hasUnsavedChanges, normalizeCardDraft } from "../../lib/formDirty";
import { DEFAULT_CARD_CATEGORIES, DEFAULT_CARD_PROMPT, DEFAULT_CARD_SYSTEM_PROMPT } from "../../types/card";
import type { CardCategory, CardInput, CardPresetOption } from "../../types/card";
import { CategoryList } from "./CategoryList";
import { CategoryOrderList } from "./CategoryOrderList";
import { GenerationCard } from "./GenerationCard";
import { MainCard } from "./MainCard";

interface CardFormProps {
  /** Начальные значения (режим редактирования); отсутствуют — режим создания. */
  initial?: CardInput;
  /** id уже сохранённой карточки — без него генерация и выгрузка недоступны (роуты требуют id). */
  cardId?: number;
  presets: CardPresetOption[];
  presetsLoading: boolean;
  /** Есть ли сохранённый ключ Tavily (useTavilyKeyStatus в CardEditPage). */
  webSearchAvailable: boolean;
  webSearchStatusLoading: boolean;
  submitting: boolean;
  /** Промис — чтобы после успеха сбросить «грязный» снапшот: экран после сохранения не закрывается. */
  onSubmit: (input: CardInput) => Promise<void>;
  /** Удаление — только при редактировании; текущее название формы — для текста подтверждения. */
  onDelete?: (name: string) => void;
  /** Копирование — только при редактировании; копия строится из текущих значений формы. */
  onDuplicate?: (input: CardInput) => void;
  /** Переход на экран выгрузки — навигация на совести страницы. */
  onExport: () => void;
}

/**
 * Форма карточки «Мастерской»: основное (промпты, пресет, инструменты), структура и порядок
 * категорий, генерация блоков и действия. Состояние держим локально (паттерн CharacterForm).
 */
export function CardForm({
  initial,
  cardId,
  presets,
  presetsLoading,
  webSearchAvailable,
  webSearchStatusLoading,
  submitting,
  onSubmit,
  onDelete,
  onDuplicate,
  onExport,
}: CardFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  // || а не ?? — пустая строка (карточка без явного system-промпта) тоже заменяется дефолтом.
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt || DEFAULT_CARD_SYSTEM_PROMPT);
  const [prompt, setPrompt] = useState(initial?.prompt ?? DEFAULT_CARD_PROMPT);
  const [categories, setCategories] = useState<CardCategory[]>(initial?.categories ?? DEFAULT_CARD_CATEGORIES);
  const [presetId, setPresetId] = useState<number | null>(initial?.presetId ?? null);
  const [useWebSearch, setUseWebSearch] = useState(initial?.useWebSearch ?? false);
  const [useAskUser, setUseAskUser] = useState(initial?.useAskUser ?? false);

  const draft = useMemo(
    () => ({ name, systemPrompt, prompt, categories, presetId, useWebSearch, useAskUser }),
    [name, systemPrompt, prompt, categories, presetId, useWebSearch, useAskUser],
  );
  // Снапшот последних сохранённых значений — база для «грязного» статуса (см. CharacterForm).
  const [baseline, setBaseline] = useState<CardInput>(() => normalizeCardDraft(draft));
  const isDirty = useMemo(() => hasUnsavedChanges(draft, baseline), [draft, baseline]);
  useUnsavedChangesGuard(isDirty);

  const canSubmit = name.trim().length > 0 && !submitting;
  const canExport = cardId !== undefined && canSubmit && canExportCard(categories);

  // Общий путь для «Сохранить», сохранения перед генерацией и перед выгрузкой: результат — boolean,
  // чтобы вызывающий не продолжал поверх проваленного сохранения.
  const save = async (): Promise<boolean> => {
    if (!canSubmit) return false;
    const payload = normalizeCardDraft(draft);
    try {
      await onSubmit(payload);
      setBaseline(payload);
      return true;
    } catch (err) {
      // Тост показывает CardEditPage; baseline не сбрасываем — правки остаются «несохранёнными».
      console.warn("Не удалось сохранить карточку", err);
      return false;
    }
  };

  // Экран выгрузки читает карточку с сервера (последнюю СОХРАНЁННУЮ версию) — при правках сперва
  // сохраняем, иначе промпт собрался бы по устаревшим блокам.
  const handleExport = async () => {
    if (!canExport) return;
    if (isDirty && !(await save())) return;
    onExport();
  };

  // Генерация уже сохранена на сервере — правим и стейт, и baseline точечно по categoryId (не
  // заменяем весь массив), чтобы не затереть несохранённые правки других категорий. pendingQuestions
  // сбрасываем: content появляется, только когда сервер закончил (в т.ч. после ответа на ask_user).
  const handleGenerated = (categoryId: string, content: string) => {
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, content, pendingQuestions: undefined } : c)));
    setBaseline((b) => ({
      ...b,
      categories: b.categories.map((c) => (c.id === categoryId ? { ...c, content } : c)),
    }));
  };

  const handlePendingQuestions = (categoryId: string, questions: CardCategory["pendingQuestions"]) => {
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, pendingQuestions: questions } : c)));
  };

  return (
    <Stack gap="lg">
      <MainCard
        name={name}
        systemPrompt={systemPrompt}
        prompt={prompt}
        presetId={presetId}
        useWebSearch={useWebSearch}
        useAskUser={useAskUser}
        presets={presets}
        presetsLoading={presetsLoading}
        webSearchAvailable={webSearchAvailable}
        webSearchStatusLoading={webSearchStatusLoading}
        onName={setName}
        onSystemPrompt={setSystemPrompt}
        onPrompt={setPrompt}
        onPresetId={setPresetId}
        onUseWebSearch={setUseWebSearch}
        onUseAskUser={setUseAskUser}
      />
      <CategoryList categories={categories} onChange={setCategories} />
      <CategoryOrderList categories={categories} onChange={setCategories} />
      <GenerationCard
        cardId={cardId}
        categories={categories}
        presetId={presetId}
        formDirty={isDirty}
        saveForm={save}
        onCategoriesChange={setCategories}
        onPendingQuestions={handlePendingQuestions}
        onGenerated={handleGenerated}
      />

      <Stack gap="sm">
        {isDirty && !submitting && (
          <Text size="sm" c="dimmed" ta="center">
            Есть несохранённые изменения
          </Text>
        )}
        <Button fullWidth disabled={!canSubmit} loading={submitting} onClick={() => void save()}>
          Сохранить
        </Button>
        <Button fullWidth variant="light" leftSection={<Upload size={18} />} disabled={!canExport} onClick={handleExport}>
          Выгрузить
        </Button>
        {!canExport && (
          <Text size="xs" c="dimmed" ta="center">
            Выгрузить в персонажа или персону можно, когда все включённые блоки сгенерированы
          </Text>
        )}
        {onDuplicate && (
          <Button
            fullWidth
            variant="default"
            leftSection={<Copy size={18} />}
            disabled={submitting}
            onClick={() => onDuplicate(normalizeCardDraft(draft))}
          >
            Скопировать карточку
          </Button>
        )}
        {onDelete && (
          <DeleteButton disabled={submitting} onClick={() => onDelete(name)}>
            Удалить карточку
          </DeleteButton>
        )}
      </Stack>
    </Stack>
  );
}
