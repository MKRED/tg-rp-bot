import { ActionIcon, Indicator, Popover, SegmentedControl, Select, Text } from "@mantine/core";
import { ArrowLeftRight, Check, ChevronLeft, Languages } from "lucide-react";
import { useState } from "react";
import type { PromptTranslateEngine } from "../../api/promptTranslate";
import { LANG_OPTIONS } from "../../constants/lang-options";
import { parseTranslateEngine, TRANSLATE_ENGINE_OPTIONS } from "../../constants/translate-engines";
import styles from "./PromptEditorOverlay.module.css";

export type TranslateBuffer = "source" | "translation";

const ICON = 20;


const BUFFER_OPTIONS = [
  { value: "source", label: "Оригинал" },
  { value: "translation", label: "Перевод" },
] satisfies { value: TranslateBuffer; label: string }[];

interface PromptEditorTranslateToolbarProps {
  onBack: () => void;
  engine: PromptTranslateEngine;
  onEngineChange: (engine: PromptTranslateEngine) => void;
  sourceLang: string;
  onSourceLangChange: (lang: string) => void;
  targetLang: string;
  onTargetLangChange: (lang: string) => void;
  onSwapLangs: () => void;
  activeBuffer: TranslateBuffer;
  onActiveBufferChange: (buffer: TranslateBuffer) => void;
  loading: boolean;
  canSyncToTranslation: boolean;
  canSyncToSource: boolean;
  onSyncToTranslation: () => void;
  onSyncToSource: () => void;
  sourceDirtyCount: number;
  translationDirtyCount: number;
  canApplyTranslation: boolean;
  onApplyTranslation: () => void;
}

/** Почему синхронизация сейчас недоступна — без объяснения серая кнопка выглядит как баг. */
function syncDisabledHint(
  activeBuffer: TranslateBuffer,
  sameLang: boolean,
  sourceDirtyCount: number,
  translationDirtyCount: number,
): string {
  if (sameLang) return "Исходный и целевой язык совпадают — переводить нечего.";
  if (sourceDirtyCount > 0 && translationDirtyCount > 0) {
    return "Обе стороны изменены и не синхронизированы — сначала разрешите одну: " +
      "отмените правки (Undo) либо очистите буфер на вкладке «Оригинал».";
  }
  if (activeBuffer === "source") {
    return "В оригинале нет новых правок для перевода. Если нужный текст уже есть на вкладке " +
      "«Перевод», переключитесь туда и нажмите «Применить».";
  }
  return "В переводе нет новых правок для переноса в оригинал.";
}

/**
 * Панель режима перевода. «Оригинал / Перевод» переключает буфер в поле независимо от того, переведён
 * ли он: можно открыть пустой перевод и сразу писать текст на другом языке (см. usePromptTranslate).
 * Кнопка синхронизации одна, контекстная: направление и доступность зависят от активного буфера и от
 * того, не изменена ли противоположная сторона (usePromptTranslate.canSyncTo*). Недоступная кнопка не
 * выключена, а по нажатию объясняет причину — на телефоне нет наведения для подсказки.
 */
export function PromptEditorTranslateToolbar({
  onBack,
  engine,
  onEngineChange,
  sourceLang,
  onSourceLangChange,
  targetLang,
  onTargetLangChange,
  onSwapLangs,
  activeBuffer,
  onActiveBufferChange,
  loading,
  canSyncToTranslation,
  canSyncToSource,
  onSyncToTranslation,
  onSyncToSource,
  sourceDirtyCount,
  translationDirtyCount,
  canApplyTranslation,
  onApplyTranslation,
}: PromptEditorTranslateToolbarProps) {
  const [hintOpen, setHintOpen] = useState(false);
  const toSource = activeBuffer === "translation";
  const syncDisabled = toSource ? !canSyncToSource : !canSyncToTranslation;
  const dirtyCount = toSource ? translationDirtyCount : sourceDirtyCount;

  const handleSync = () => {
    if (loading) return;
    if (syncDisabled) {
      setHintOpen((o) => !o);
      return;
    }
    setHintOpen(false);
    if (toSource) onSyncToSource();
    else onSyncToTranslation();
  };

  return (
    <div className={styles.translateToolbar}>
      <div className={`${styles.row} ${styles.wrapRow}`}>
        <ActionIcon variant="subtle" className={styles.tool} color="gray" size="lg" onClick={onBack} aria-label="К инструментам текста">
          <ChevronLeft size={ICON} />
        </ActionIcon>
        <SegmentedControl
          size="sm"
          data={TRANSLATE_ENGINE_OPTIONS}
          value={engine}
          onChange={(v) => onEngineChange(parseTranslateEngine(v))}
          aria-label="Движок перевода"
        />
        <SegmentedControl
          size="sm"
          className={styles.buffer}
          data={BUFFER_OPTIONS}
          value={activeBuffer}
          onChange={(v) => onActiveBufferChange(v as TranslateBuffer)}
          aria-label="Буфер в поле"
        />
      </div>

      <div className={styles.row}>
        <Select
          size="sm"
          className={styles.lang}
          data={LANG_OPTIONS}
          value={sourceLang}
          allowDeselect={false}
          onChange={(v) => v && onSourceLangChange(v)}
          aria-label="Исходный язык"
        />
        <ActionIcon variant="subtle" className={styles.tool} color="gray" size="lg" onClick={onSwapLangs} aria-label="Поменять языки местами">
          <ArrowLeftRight size={ICON} />
        </ActionIcon>
        <Select
          size="sm"
          className={styles.lang}
          data={LANG_OPTIONS}
          value={targetLang}
          allowDeselect={false}
          onChange={(v) => v && onTargetLangChange(v)}
          aria-label="Язык перевода"
        />

        <div className={styles.actions}>
          {/* «Применить» — не синхронизация (без повторного перевода), поэтому не залитая. */}
          {toSource && (
            <ActionIcon
              variant="light"
              size="lg"
              onClick={onApplyTranslation}
              disabled={!canApplyTranslation}
              aria-label="Сделать перевод оригиналом"
              title="Сделать текущий перевод оригиналом — без повторного перевода"
            >
              <Check size={ICON} />
            </ActionIcon>
          )}
          <Popover opened={hintOpen} onChange={setHintOpen} width={260} position="bottom-end" withArrow shadow="md">
            <Popover.Target>
              <Indicator label={dirtyCount} size={16} color="red" disabled={dirtyCount === 0} offset={2}>
                <ActionIcon
                  size="lg"
                  onClick={handleSync}
                  loading={loading}
                  data-disabled={syncDisabled || undefined}
                  aria-disabled={syncDisabled}
                  aria-label={toSource ? "Перенести правки в оригинал" : "Перевести правки"}
                >
                  <Languages size={ICON} />
                </ActionIcon>
              </Indicator>
            </Popover.Target>
            <Popover.Dropdown>
              <Text size="sm">{syncDisabledHint(activeBuffer, sourceLang === targetLang, sourceDirtyCount, translationDirtyCount)}</Text>
            </Popover.Dropdown>
          </Popover>
        </div>
      </div>
    </div>
  );
}
