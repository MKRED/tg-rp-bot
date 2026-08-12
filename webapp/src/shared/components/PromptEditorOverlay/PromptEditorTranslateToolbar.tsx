import { Caption, Spinner } from "@telegram-apps/telegram-ui";
import { ArrowLeftRight, Check, ChevronLeft, FileText, Globe, Languages, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { PromptTranslateEngine } from "../../api/promptTranslate";
import { LANG_OPTIONS } from "../../constants/lang-options";
import { LangPicker } from "../LangPicker";
import { SegmentedToggle } from "../SegmentedToggle";
import "./PromptEditorTranslateToolbar.css";

export type TranslateBuffer = "source" | "translation";

const ICON_SIZE = 16;

const ENGINE_OPTIONS = [
  { value: "google", label: "Google", icon: <Globe size={ICON_SIZE} /> },
  { value: "ai", label: "ИИ", icon: <Sparkles size={ICON_SIZE} /> },
] as const satisfies { value: PromptTranslateEngine; label: string; icon: ReactNode }[];

const BUFFER_OPTIONS = [
  { value: "source", label: "Оригинал", icon: <FileText size={ICON_SIZE} /> },
  { value: "translation", label: "Перевод", icon: <Languages size={ICON_SIZE} /> },
] as const satisfies { value: TranslateBuffer; label: string; icon: ReactNode }[];

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

/** Почему кнопка синка сейчас неактивна — коротким текстом в title, а не молчаливым disabled:
 * без объяснения серая кнопка выглядит как баг, а не как ожидаемое состояние (см. вопрос
 * пользователя "почему кнопка серая", разобранный при добавлении этой подсказки). */
function syncDisabledHint(
  activeBuffer: TranslateBuffer,
  sameLang: boolean,
  sourceDirtyCount: number,
  translationDirtyCount: number,
): string | undefined {
  if (sameLang) return "Исходный и целевой язык совпадают — переводить нечего.";
  const bothPending = sourceDirtyCount > 0 && translationDirtyCount > 0;
  if (bothPending) {
    return "Обе стороны изменены и не синхронизированы — сначала разрешите одну: " +
      "отмените правки (Undo) либо очистите буфер на вкладке «Оригинал».";
  }
  if (activeBuffer === "source" && sourceDirtyCount === 0) {
    return "В оригинале нет новых правок для перевода. Если нужный текст уже есть на вкладке " +
      "«Перевод», переключитесь туда и нажмите «Применить».";
  }
  if (activeBuffer === "translation" && translationDirtyCount === 0) {
    return "В переводе нет новых правок для переноса в оригинал.";
  }
  return undefined;
}

/**
 * Бар инструментов режима перевода — второй режим панели (переключается кнопкой в
 * PromptEditorToolbar). Тоггл «Оригинал/Перевод» независим от того, синхронизировался ли уже этот
 * буфер — можно открыть пустой перевод и сразу писать новый текст на другом языке (см.
 * usePromptTranslate). Кнопка синка — одна, контекстная: направление и disabled зависят от того,
 * какой буфер сейчас активен и не «грязна» ли противоположная сторона (защита от одновременной
 * несинхронизированности с обеих сторон — см. usePromptTranslate.canSyncTo*).
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
  const sameLang = sourceLang === targetLang;

  const sync =
    activeBuffer === "source"
      ? {
          label: "→ Перевод",
          ariaLabel: "Синхронизировать в перевод",
          onClick: onSyncToTranslation,
          disabled: !canSyncToTranslation,
          dirty: sourceDirtyCount,
        }
      : {
          label: "→ Оригинал",
          ariaLabel: "Синхронизировать в оригинал",
          onClick: onSyncToSource,
          disabled: !canSyncToSource,
          dirty: translationDirtyCount,
        };
  const syncTitle = sync.disabled
    ? syncDisabledHint(activeBuffer, sameLang, sourceDirtyCount, translationDirtyCount)
    : undefined;

  return (
    <div className="prompt-editor-translate-toolbar">
      <div className="prompt-editor-translate-toolbar__row">
        <button
          type="button"
          className="prompt-editor-overlay__toolbar-btn"
          onClick={onBack}
          aria-label="К инструментам текста"
        >
          <ChevronLeft size={18} />
        </button>
        <SegmentedToggle options={ENGINE_OPTIONS} value={engine} onChange={onEngineChange} ariaLabel="Движок перевода" />
        <SegmentedToggle
          options={BUFFER_OPTIONS}
          value={activeBuffer}
          onChange={onActiveBufferChange}
          ariaLabel="Показываемый буфер"
        />
      </div>
      <div className="prompt-editor-translate-toolbar__row">
        <LangPicker value={sourceLang} onChange={onSourceLangChange} options={LANG_OPTIONS} compact />
        <button
          type="button"
          className="prompt-editor-overlay__toolbar-btn"
          onClick={onSwapLangs}
          aria-label="Поменять языки местами"
        >
          <ArrowLeftRight size={18} />
        </button>
        <LangPicker value={targetLang} onChange={onTargetLangChange} options={LANG_OPTIONS} compact />
        <div className="prompt-editor-translate-toolbar__actions">
          {activeBuffer === "translation" && (
            <button
              type="button"
              className="prompt-editor-translate-toolbar__apply"
              onClick={onApplyTranslation}
              disabled={!canApplyTranslation}
              aria-label="Использовать перевод как оригинал"
              title="Сделать текущий перевод оригиналом — без повторного перевода"
            >
              <Check size={16} />
            </button>
          )}
          <button
            type="button"
            className="prompt-editor-translate-toolbar__sync"
            onClick={sync.onClick}
            disabled={sync.disabled}
            aria-label={sync.ariaLabel}
            title={syncTitle ?? sync.label}
          >
            {loading ? <Spinner size="s" /> : <Languages size={16} />}
            {sync.dirty > 0 && (
              <Caption level="1" className="prompt-editor-translate-toolbar__badge">
                {sync.dirty}
              </Caption>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
