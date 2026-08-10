import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDefaultTranslateSettings,
  translateBlocksApi,
  type PromptTranslateEngine,
} from "../../api/promptTranslate";
import {
  applySyncResults,
  dirtyIndices,
  hasDirty,
  joinSource,
  joinTranslation,
  mergeTranslated,
  realignBlocks,
  splitTranslatable,
  type BlockSide,
  type TranslateBlock,
} from "./translateBlocks";

type BufferSide = "source" | "translation";

/**
 * Оркестрация режима перевода PromptEditorOverlay: языковая пара/движок (сидятся один раз из
 * настроек пользователя, дальше живут только в рамках сессии оверлея — назад в настройки не
 * пишутся), массив TranslateBlock[] и два симметричных действия синхронизации.
 *
 * sourceText/translationText — ЖИВЫЕ значения буферов (source.draft/translation.draft из
 * useTextHistory в PromptEditorOverlay.tsx). blocks сидируется УЖЕ ПРИ МОНТИРОВАНИИ реальным
 * содержимым source (realignBlocks([], sourceText, "source") — каждый абзац с sourceAtLastSync=""),
 * а не пустым массивом: иначе joinSource([]) === "" и live-сравнение с непустым sourceText считало
 * бы «изменено» абсолютно любое уже существующее содержимое поля, а не только реальные правки —
 * из-за этого сценарий «написать новый текст сразу в пустом переводе» на непустом поле мгновенно
 * упирался в двустороннюю «грязность» и дедлокал обе кнопки синка (обе disabled без выхода).
 *
 * «Есть что синкать» (hasDirty на живом realign) и «безопасно ли синкать» (не dirty ли
 * ПРОТИВОПОЛОЖНАЯ сторона) — две независимые проверки, а не одна общая live-diff-с-blocks: только
 * так «уже переведено» (dirty после реального синка) отличимо от «ещё не переведено» (dirty с
 * самого монтирования, т.к. AtLastSync="").
 *
 * onTranslationSynced/onSourceSynced/onBufferChange — коллбэки применения результата к
 * useTextHistory-буферам родителя (reset для перевода — новая сессия перевода не должна быть шагом
 * undo прежней; commit для оригинала — перенос остаётся отменяемым шагом истории source).
 */
export function usePromptTranslate(
  sourceText: string,
  translationText: string,
  onTranslationSynced: (text: string) => void,
  onSourceSynced: (text: string) => void,
  onBufferChange: (buffer: BufferSide) => void,
) {
  const [engine, setEngine] = useState<PromptTranslateEngine>("google");
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("ru");
  const [blocks, setBlocks] = useState<TranslateBlock[]>(() => realignBlocks([], sourceText, "source"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDefaultTranslateSettings()
      .then((settings) => {
        if (cancelled) return;
        setEngine(settings.engine);
        setTargetLang(settings.targetLang);
        // Дефолтный sourceLang не хранится отдельно (пары нет в настройках) — раздвигаем его с
        // targetLang, если они совпали: иначе первый же синк молча "переводит" на тот же язык.
        setSourceLang((prev) => (prev === settings.targetLang ? (settings.targetLang === "en" ? "ru" : "en") : prev));
      })
      .catch((err) => console.error("Не удалось загрузить настройки перевода по умолчанию", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const swapLangs = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  }, [sourceLang, targetLang]);

  // Живой (пересчитывается на каждое изменение текста/blocks) реалайн обеих сторон — источник
  // истины и для guard'ов, и для счётчиков грязных абзацев; сам синк (runSync) пересчитывает
  // такой же реалайн заново на момент клика — минимальная лишняя работа, зато без риска читать
  // устаревший снэпшот между рендером и кликом.
  const sourceRealigned = useMemo(() => realignBlocks(blocks, sourceText, "source"), [blocks, sourceText]);
  const translationRealigned = useMemo(
    () => realignBlocks(blocks, translationText, "translation"),
    [blocks, translationText],
  );
  const sourcePending = hasDirty(sourceRealigned, "source");
  const translationPending = hasDirty(translationRealigned, "translation");
  const sameLang = sourceLang === targetLang;

  const canSyncToTranslation = sourcePending && !translationPending && !sameLang && !loading;
  const canSyncToSource = translationPending && !sourcePending && !sameLang && !loading;

  const runSync = useCallback(
    async (side: BlockSide, currentText: string): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        const realigned = realignBlocks(blocks, currentText, side);
        const dirty = dirtyIndices(realigned, side);
        if (dirty.length === 0) {
          setBlocks(realigned);
          return side === "source" ? joinTranslation(realigned) : joinSource(realigned);
        }

        const dirtyTexts = dirty.map((i) => (side === "source" ? realigned[i]!.source : realigned[i]!.translation));
        const split = splitTranslatable(dirtyTexts.map((content) => ({ content, separatorAfter: "" })));

        // Направление перевода зависит от того, ОТКУДА синкаем: source→translation обычным
        // порядком языков, translation→source — со swapped парой (перевод "обратно").
        const requestSourceLang = side === "source" ? sourceLang : targetLang;
        const requestTargetLang = side === "source" ? targetLang : sourceLang;

        const translated =
          split.texts.length > 0
            ? await translateBlocksApi({
                blocks: split.texts,
                sourceLang: requestSourceLang,
                targetLang: requestTargetLang,
                mode: engine,
              })
            : [];

        const perDirty = mergeTranslated(
          dirtyTexts.map((content) => ({ content, separatorAfter: "" })),
          split,
          translated,
        );

        const applied = applySyncResults(realigned, side, dirty, perDirty);
        setBlocks(applied);
        return side === "source" ? joinTranslation(applied) : joinSource(applied);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось перевести текст");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [blocks, engine, sourceLang, targetLang],
  );

  const syncToTranslation = useCallback(async () => {
    const result = await runSync("source", sourceText);
    if (result === null) return;
    onTranslationSynced(result);
    onBufferChange("translation");
  }, [runSync, sourceText, onTranslationSynced, onBufferChange]);

  const syncToSource = useCallback(async () => {
    const result = await runSync("translation", translationText);
    if (result === null) return;
    onSourceSynced(result);
    onBufferChange("source");
  }, [runSync, translationText, onSourceSynced, onBufferChange]);

  return {
    engine,
    setEngine,
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    swapLangs,
    loading,
    error,
    /** Абзацев, не перенесённых на другую сторону — источник заполнен/правлен, но синка ещё не было. */
    sourceDirtyCount: dirtyIndices(sourceRealigned, "source").length,
    translationDirtyCount: dirtyIndices(translationRealigned, "translation").length,
    /** Есть контент в переводе, ещё не перенесённый в source — сохранение/закрытие его молча
     * отбросит (onSave пишет только source), поэтому вызывающий код должен предупредить. */
    hasUnsyncedTranslation: translationPending,
    canSyncToTranslation,
    canSyncToSource,
    syncToTranslation,
    syncToSource,
  };
}

export type UsePromptTranslateResult = ReturnType<typeof usePromptTranslate>;
