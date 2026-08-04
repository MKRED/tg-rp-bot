import { Accordion, Button, Caption, Input, Section } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { DeleteButton } from "../../../../shared/components/DeleteButton";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { SectionActions } from "../../../../shared/components/SectionActions";
import { useUnsavedChangesGuard } from "../../../../shared/telegram/useUnsavedChangesGuard";
import { hasUnsavedChanges, normalizeCardDraft } from "../../lib/formDirty";
import {
  DEFAULT_CARD_CATEGORIES,
  DEFAULT_CARD_PROMPT,
  DEFAULT_CARD_SYSTEM_PROMPT,
} from "../../types/card";
import type { CardCategory, CardInput, CardPresetOption } from "../../types/card";
import { CategoryList } from "./CategoryList";
import { CategoryOrderList } from "./CategoryOrderList";
import { GenerationSection } from "./GenerationSection";
import { PresetPicker } from "./PresetPicker";

const UNSAVED_T = { duration: 0.2, ease: "easeOut" as const };

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
  /** Удаление доступно только при редактировании. Текущее название формы (не последний сохранённый
   * снапшот) — чтобы подтверждение показывало то же имя, что видит пользователь прямо сейчас. */
  onDelete?: (name: string) => void;
  /** Копирование доступно только при редактировании — как и удаление, для ещё не созданной
   * карточки копировать нечего (это просто повторное создание). Текущие значения формы (в т.ч.
   * несохранённые правки) — то, что видит пользователь, поэтому копия строится из них, а не
   * из последнего сохранённого снапшота. */
  onDuplicate?: (input: CardInput) => void;
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
  onDuplicate,
}: CardFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  // || а не ?? — пустая строка (карточка без явного system-промпта) тоже должна замениться
  // дефолтом, а не остаться пустой (сервер теперь подстраховывает то же самое на чтении/записи,
  // см. decryptCardRow/updateCard, но форма не должна на это полагаться).
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt || DEFAULT_CARD_SYSTEM_PROMPT);
  const [prompt, setPrompt] = useState(initial?.prompt ?? DEFAULT_CARD_PROMPT);
  const [categories, setCategories] = useState<CardCategory[]>(
    initial?.categories ?? DEFAULT_CARD_CATEGORIES,
  );
  const [presetId, setPresetId] = useState<number | null>(initial?.presetId ?? null);

  // Структура/порядок полей свёрнуты по умолчанию — редактируются реже основного промпта.
  const [structureOpen, setStructureOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  // Снапшот последних сохранённых значений — база для «грязного» статуса (см. CharacterForm).
  const [baseline, setBaseline] = useState<CardInput>(() =>
    normalizeCardDraft({
      name: initial?.name ?? "",
      systemPrompt: initial?.systemPrompt || DEFAULT_CARD_SYSTEM_PROMPT,
      prompt: initial?.prompt ?? DEFAULT_CARD_PROMPT,
      categories: initial?.categories ?? DEFAULT_CARD_CATEGORIES,
      presetId: initial?.presetId ?? null,
    }),
  );
  const isDirty = useMemo(
    () => hasUnsavedChanges({ name, systemPrompt, prompt, categories, presetId }, baseline),
    [name, systemPrompt, prompt, categories, presetId, baseline],
  );
  useUnsavedChangesGuard(isDirty);

  const canSubmit = name.trim().length > 0 && !submitting;

  // Вынесено из handleSubmit — тем же путём сохраняет карточку и GenerationSection перед
  // генерацией по несохранённым данным (см. onSaveBeforeGenerate): результат нужен как boolean,
  // чтобы вызывающий знал, продолжать ли (генерацию не запускаем поверх проваленного сохранения).
  const save = async (): Promise<boolean> => {
    if (!canSubmit) return false;
    const payload = normalizeCardDraft({ name, systemPrompt, prompt, categories, presetId });
    try {
      await onSubmit(payload);
      setBaseline(payload);
      return true;
    } catch {
      // Ошибку показывает CardEditPage (тост) — здесь просто не сбрасываем baseline.
      return false;
    }
  };

  const handleSubmit = () => {
    void save();
  };

  const handleDuplicate = () => {
    onDuplicate?.(normalizeCardDraft({ name, systemPrompt, prompt, categories, presetId }));
  };

  // Генерация блока уже сохранена на сервере (см. generateCardBlock) — синхронизируем и локальный
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
    <>
      <Section className="section-blend-inputs" header="Карточка">
        <Input
          header="Название"
          placeholder="Название карточки"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <PromptEditorField
          header="Системный промпт"
          hint="Инструкции ИИ о самом процессе генерации: что блоки создаются строго по одному, что <example> ниже — только образец формата, а не готовый ответ. Не зависит от конкретного персонажа."
          placeholder={DEFAULT_CARD_SYSTEM_PROMPT}
          value={systemPrompt}
          previewLines={6}
          onChange={setSystemPrompt}
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
      </Section>

      <Accordion expanded={structureOpen} onChange={setStructureOpen}>
        <Accordion.Summary>Структура карточки</Accordion.Summary>
        <Accordion.Content>
          <CategoryList categories={categories} onChange={setCategories} />
        </Accordion.Content>
      </Accordion>

      <Accordion expanded={orderOpen} onChange={setOrderOpen}>
        <Accordion.Summary>Последовательность полей</Accordion.Summary>
        <Accordion.Content>
          <CategoryOrderList categories={categories} onChange={setCategories} />
        </Accordion.Content>
      </Accordion>

      <Section className="section-blend-inputs" header="Генерация">
        <GenerationSection
          cardId={cardId}
          categories={categories}
          presetId={presetId}
          formDirty={isDirty}
          onSaveBeforeGenerate={save}
          onContentChange={setCategories}
          onGenerated={handleGenerated}
        />

        <SectionActions>
          <AnimatePresence initial={false}>
            {isDirty && !submitting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={UNSAVED_T}
                style={{ overflow: "hidden" }}
              >
                <Caption level="1" className="card-form__unsaved">
                  Есть несохранённые изменения
                </Caption>
              </motion.div>
            )}
          </AnimatePresence>
          <Button size="l" stretched disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? "Сохранение…" : "Сохранить"}
          </Button>
          {onDuplicate && (
            <Button size="l" stretched mode="outline" disabled={submitting} onClick={handleDuplicate}>
              Скопировать карточку
            </Button>
          )}
          {onDelete && (
            <DeleteButton disabled={submitting} onClick={() => onDelete(name)}>
              Удалить карточку
            </DeleteButton>
          )}
        </SectionActions>
      </Section>
    </>
  );
}
