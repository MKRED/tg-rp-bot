import { Spinner } from "@telegram-apps/telegram-ui";
import { ArrowLeftRight, ChevronLeft, Languages } from "lucide-react";
import type { PromptTranslateEngine } from "../../api/promptTranslate";
import { LANG_OPTIONS } from "../../constants/lang-options";
import { LangPicker } from "../LangPicker";
import { SegmentedToggle } from "../SegmentedToggle";
import "./PromptEditorTranslateToolbar.css";

export type TranslateBuffer = "source" | "translation";

const ENGINE_OPTIONS = [
  { value: "google", label: "Google" },
  { value: "ai", label: "ИИ" },
] as const satisfies { value: PromptTranslateEngine; label: string }[];

const BUFFER_OPTIONS = [
  { value: "source", label: "Оригинал" },
  { value: "translation", label: "Перевод" },
] as const satisfies { value: TranslateBuffer; label: string }[];

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
}: PromptEditorTranslateToolbarProps) {
  // Обе стороны одновременно "грязные" (есть неперенесённые правки и там, и там) — синк в любую
  // сторону намеренно заблокирован (перезаписал бы несинхронизированные правки другой стороны).
  // Явно объясняем это в title — иначе неактивная кнопка выглядит как баг, а не как защита.
  const bothPending = sourceDirtyCount > 0 && translationDirtyCount > 0;
  const conflictHint = "Обе стороны изменены и не синхронизированы — сначала разрешите одну: " +
    "отмените правки (Undo) либо очистите буфер на вкладке «Оригинал».";

  const sync =
    activeBuffer === "source"
      ? {
          label: "→ Перевод",
          ariaLabel: "Синхронизировать в перевод",
          onClick: onSyncToTranslation,
          disabled: !canSyncToTranslation,
          dirty: sourceDirtyCount,
          title: !canSyncToTranslation && bothPending ? conflictHint : undefined,
        }
      : {
          label: "→ Оригинал",
          ariaLabel: "Синхронизировать в оригинал",
          onClick: onSyncToSource,
          disabled: !canSyncToSource,
          dirty: translationDirtyCount,
          title: !canSyncToSource && bothPending ? conflictHint : undefined,
        };

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
        <LangPicker value={sourceLang} onChange={onSourceLangChange} options={LANG_OPTIONS} />
        <button
          type="button"
          className="prompt-editor-overlay__toolbar-btn"
          onClick={onSwapLangs}
          aria-label="Поменять языки местами"
        >
          <ArrowLeftRight size={16} />
        </button>
        <LangPicker value={targetLang} onChange={onTargetLangChange} options={LANG_OPTIONS} />
        <button
          type="button"
          className="prompt-editor-translate-toolbar__sync"
          onClick={sync.onClick}
          disabled={sync.disabled}
          aria-label={sync.ariaLabel}
          title={sync.title}
        >
          {loading ? <Spinner size="s" /> : <Languages size={16} />}
          <span>{sync.label}</span>
          {sync.dirty > 0 && <span className="prompt-editor-translate-toolbar__badge">{sync.dirty}</span>}
        </button>
      </div>
    </div>
  );
}
