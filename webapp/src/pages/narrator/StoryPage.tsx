import { useCallback, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { storyGraphPath, storySettingsPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { FullHeightPage } from "../../shared/components/FullHeightPage";
import { TranslateSheet } from "../../shared/components/TranslateSheet";
import { confirmAction } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";
import {
  LANG_OPTIONS,
  StoryFeed,
  StoryHeader,
  StoryInput,
  StoryMessageItem,
  composeStoryTranslate,
  deleteStoryMessage,
  editStoryBeat,
  storyTranslateFlags,
  switchBranch,
  useStory,
  useStoryGeneration,
  useStorySettings,
  useStoryTranslation,
  type StoryFeedHandle,
  type StoryInputHandle,
  type StoryMessage,
} from "../../features/narrator";

/** Экран истории: шапка, лента битов и директив, поле режиссёра, шторка перевода черновика. */
export function StoryPage() {
  const { id } = useParams<{ id: string }>();
  const storyId = Number(id);
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();
  const feedRef = useRef<StoryFeedHandle>(null);
  const inputRef = useRef<StoryInputHandle>(null);
  const [translateOpen, setTranslateOpen] = useState(false);

  const { story, messages, setMessages, loading, error, reload, retry } = useStory(storyId);
  const { settings } = useStorySettings(storyId);
  const { translate, retranslate, removeTranslation, autoTranslatingIds, suppressAutoTranslate } =
    useStoryTranslation(storyId, messages, setMessages, settings, Boolean(story));

  // Готовый бит подменяет потоковый — без анимации появления (мелькание текста).
  const handleBeatDone = useCallback((beat: StoryMessage) => feedRef.current?.markAnimated(beat.id), []);
  const handleDirectiveLost = useCallback((directive: string) => inputRef.current?.setDraft(directive), []);
  const { advance, regenerate, sending, streamingText, statusPhase } = useStoryGeneration(storyId, {
    setMessages,
    reload,
    onBeatDone: handleBeatDone,
    onDirectiveLost: handleDirectiveLost,
  });

  // Не findLast: ES2023, сборка — es2022 (методы не транспилируются), а WebView Telegram бывают старыми.
  const lastBeatId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  /** Действие над историей и тихая пересинхронизация ленты; ошибка каждого шага — свой тост. */
  const mutate = async (action: () => Promise<unknown>, errorMessage: string) => {
    try {
      await action();
    } catch (err) {
      console.error(errorMessage, err);
      showToast({ type: "error", message: errorMessage });
      return;
    }
    try {
      await reload();
    } catch (err) {
      // Само действие прошло — не пишем «не удалось удалить», если не обновилась только лента.
      console.error("Failed to reload story", err);
      showToast({ type: "error", message: "Не удалось обновить историю" });
    }
  };

  // Смена варианта и откат к биту — один и тот же переход курсора истории (как клик по узлу графа).
  // Автоперевод гасим только после удачного перехода: иначе флаг остался бы взведённым и съел бы
  // автоперевод следующей директивы.
  const moveCursor = (messageId: number, errorMessage: string) => {
    if (sending) return Promise.resolve();
    return mutate(() => switchBranch(storyId, messageId).then(suppressAutoTranslate), errorMessage);
  };

  const handleDelete = async (messageId: number) => {
    if (sending) return;
    const ok = await confirmAction("Удалить этот бит и всё, что после него?", {
      title: "Удаление бита",
      confirmText: "Удалить",
    });
    if (ok) await mutate(() => deleteStoryMessage(storyId, messageId), "Не удалось удалить бит");
  };

  // Правка текста бита на месте (без перегенерации и нового варианта). Перевод не перезапускаем — сервер
  // сбросил кэш, перевести заново можно кнопкой. Бросает при неудаче — редактор остаётся открытым.
  const handleEdit = async (messageId: number, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      showToast({ type: "error", message: "Текст бита не может быть пустым" });
      throw new Error("Story beat content cannot be empty");
    }
    try {
      const updated = await editStoryBeat(storyId, messageId, trimmed);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: updated.content, translations: updated.translations } : m,
        ),
      );
    } catch (err) {
      console.error("Failed to edit story beat", err);
      showToast({ type: "error", message: "Не удалось сохранить текст" });
      throw err;
    }
  };

  return (
    <FullHeightPage>
      {story && (
        <StoryHeader
          title={story.title ?? story.book.name}
          avatars={story.book.avatars}
          onGraphClick={() => navigate(storyGraphPath(storyId))}
          onSettingsClick={() => navigate(storySettingsPath(storyId))}
        />
      )}

      <StoryFeed
        ref={feedRef}
        storyId={storyId}
        messages={messages}
        loading={loading}
        error={story ? null : error}
        onRetry={retry}
        streamingText={streamingText}
        statusPhase={statusPhase}
        renderMessage={(m) => {
          const flags = storyTranslateFlags(settings, m);
          return (
            <StoryMessageItem
              message={m}
              isLast={m.id === lastBeatId && streamingText === null}
              disabled={sending}
              showTranslateButton={flags.button}
              targetLang={settings.translateTargetLang}
              autoShowTranslation={flags.autoShow}
              autoTranslating={autoTranslatingIds.has(m.id)}
              onTranslate={translate}
              onRetranslate={retranslate}
              onDeleteTranslation={removeTranslation}
              quickRollbackEnabled={settings.quickRollbackEnabled}
              editEnabled={settings.editEnabled}
              onQuickRollback={(messageId) => moveCursor(messageId, "Не удалось откатиться к биту")}
              onEdit={handleEdit}
              onSwitchSibling={(siblingId) => void moveCursor(siblingId, "Не удалось переключить вариант")}
              onRegenerate={regenerate}
              onDelete={(messageId) => void handleDelete(messageId)}
            />
          );
        }}
      />

      {story && (
        <StoryInput
          ref={inputRef}
          onAdvance={advance}
          onTranslate={() => setTranslateOpen(true)}
          disabled={sending}
        />
      )}

      <TranslateSheet
        opened={translateOpen}
        translate={(p) => composeStoryTranslate(storyId, p)}
        langOptions={LANG_OPTIONS}
        onPick={(text) => {
          inputRef.current?.setDraft(text);
          setTranslateOpen(false);
        }}
        onClose={() => setTranslateOpen(false)}
      />
    </FullHeightPage>
  );
}
