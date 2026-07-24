import { Spinner } from "@telegram-apps/telegram-ui";
import { AnimatePresence } from "framer-motion";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { storyGraphPath, storySettingsPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { RpText } from "../../shared/components/RpText";
import { TranslateSheet } from "../../shared/components/TranslateSheet";
import {
  BeatDivider,
  StoryHeader,
  StoryInput,
  StoryMessageItem,
  LANG_OPTIONS,
  advanceStory,
  composeStoryTranslate,
  deleteStoryMessage,
  deleteStoryTranslation,
  regenerateBeat,
  switchBranch,
  translateStoryMessage,
  useStory,
  useStoryAutoTranslate,
  useStorySettings,
} from "../../features/narrator";
import { confirmAction } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";
import type { StoryInputHandle, StoryMessage } from "../../features/narrator";
import "./narrator.css";

/** Экран истории: лента битов + директив, поле режиссёра, стриминг следующего бита. */
export function StoryPage() {
  const params = useParams();
  const id = Number(params.id);

  const navigate = useTransitionNavigate();
  const { story, messages, setMessages, loading, error, reload } = useStory(id);
  const { settings } = useStorySettings(id);
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  // Фаза фонового статуса перед битом (напр. "compacting" — авто-сжатие истории).
  const [statusPhase, setStatusPhase] = useState<string | null>(null);
  const [translateOpen, setTranslateOpen] = useState(false);
  const storyInputRef = useRef<StoryInputHandle>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Первый скролл к низу при открытии истории — мгновенный (без видимой долгой прокрутки
  // от верха), далее новые биты/стриминг скроллим плавно.
  const didInitialScroll = useRef(false);

  // Автопрокрутка к низу при новых сообщениях/стриминге. Зависим от ДЛИНЫ ленты, а не от
  // её содержимого: перевод бита/директивы меняет текст сообщения (но не их число) и не
  // должен дёргать ленту вниз.
  useEffect(() => {
    if (!messages.length) return;
    const behavior = didInitialScroll.current ? "smooth" : "auto";
    bottomRef.current?.scrollIntoView({ behavior });
    didInitialScroll.current = true;
  }, [messages.length, streamingText]);

  // Переводит бит/директиву и вливает перевод в локальную ленту (чтобы тоггл показал его сразу).
  const handleTranslate = useCallback(
    async (msgId: number, lang: string): Promise<string> => {
      const translation = await translateStoryMessage(id, msgId, lang);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, translations: { ...(m.translations ?? {}), [lang]: translation } }
            : m,
        ),
      );
      return translation;
    },
    [id, setMessages],
  );

  // Пересчитывает перевод бита/директивы заново (игнорируя кэш) — меню долгого нажатия на Globe.
  // Promise возвращаем, чтобы StoryMessageItem мог показать спиннер на кнопке на время запроса.
  const handleRetranslate = useCallback(async (msgId: number, lang: string) => {
    try {
      const translation = await translateStoryMessage(id, msgId, lang, { force: true });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, translations: { ...(m.translations ?? {}), [lang]: translation } }
            : m,
        ),
      );
    } catch (err) {
      console.error("Failed to retranslate story message", err);
    }
  }, [id, setMessages]);

  // Убирает закэшированный перевод бита/директивы — меню долгого нажатия на Globe.
  const handleDeleteTranslation = useCallback(async (msgId: number, lang: string) => {
    try {
      await deleteStoryTranslation(id, msgId, lang);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId || !m.translations) return m;
          const { [lang]: _removed, ...rest } = m.translations;
          return { ...m, translations: rest };
        }),
      );
    } catch (err) {
      console.error("Failed to delete story translation", err);
    }
  }, [id, setMessages]);

  // Авто-перевод новых сообщений вынесен в хук; suppressNextRun зовём при смене ветки.
  const { suppressNextRun, autoTranslatingIds } = useStoryAutoTranslate(messages, settings, handleTranslate);

  const lastBeatId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  const advance = (directive: string) => {
    if (sending) return;
    setSending(true);
    setStreamingText("");
    advanceStory(id, directive, {
      onUserMessage: (msg: StoryMessage) => setMessages((prev) => [...prev, msg]),
      onStatus: (phase) => setStatusPhase(phase),
      onToken: (text) => {
        setStatusPhase(null); // первый токен бита → фаза статуса (сжатие) завершена
        setStreamingText((prev) => (prev ?? "") + text);
      },
      onReset: () => setStreamingText(""),
      // Стрим снимаем в одном батче с появлением реального бита (onApplied внутри reload) —
      // иначе лента на миг укоротилась бы (скролл вверх) до прихода бита (скролл обратно вниз).
      onDone: () => {
        setStatusPhase(null);
        reload(() => setStreamingText(null));
      },
      onError: () => {
        setStatusPhase(null);
        setStreamingText(null);
        showToast({ type: "error", message: "Не удалось продолжить историю" });
      },
    }).finally(() => {
      setSending(false);
    });
  };

  const regenerate = (beatId: number) => {
    if (sending) return;
    setSending(true);
    setStreamingText("");
    // Оптимистично убираем регенерируемый бит — иначе стримящийся вариант появлялся бы
    // под старым битом, а замена происходила только после reload(). Бит вернётся (новым
    // сиблингом) после завершения генерации; реген доступен лишь на последнем бите.
    setMessages((prev) => prev.filter((m) => m.id !== beatId));
    regenerateBeat(id, beatId, {
      onToken: (text) => setStreamingText((prev) => (prev ?? "") + text),
      onReset: () => setStreamingText(""),
      // Снимаем стрим в одном батче с reload — см. коммент в advance (без «дёрганья» ленты).
      onDone: () => {
        reload(() => setStreamingText(null));
      },
      onError: () => {
        setStreamingText(null);
        showToast({ type: "error", message: "Не удалось перегенерировать бит" });
        reload(); // вернуть оптимистично убранный бит (сервер откатил курсор на исходный)
      },
    }).finally(() => {
      setSending(false);
    });
  };

  const handleDelete = async (msgId: number) => {
    if (sending) return;
    const confirmed = await confirmAction("Удалить этот бит и всё, что после него?", {
      title: "Удаление бита",
    });
    if (!confirmed) return;
    try {
      await deleteStoryMessage(id, msgId);
    } catch {
      showToast({ type: "error", message: "Не удалось удалить бит" });
    }
    reload();
  };

  const handleSwitch = async (siblingId: number) => {
    if (sending) return;
    suppressNextRun(); // ветка историческая — не авто-переводим её сообщения
    try {
      await switchBranch(id, siblingId);
    } catch {
      showToast({ type: "error", message: "Не удалось переключить ветку" });
    }
    reload();
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="story-page__fullcenter">
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }
  if (error || !story) {
    return (
      <PageTransition>
        <div className="story-page__fullcenter">История не найдена</div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
        <StoryHeader
          title={story.title ?? story.book.name}
          avatars={story.book.avatars}
          onGraphClick={() => navigate(storyGraphPath(id))}
          onSettingsClick={() => navigate(storySettingsPath(id))}
        />

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px", display: "flex", flexDirection: "column" }}>
          {messages.map((m, i) => {
            // Кнопку перевода показываем на бите/директиве согласно scope (assistant=бит, user=директива).
            const showTranslateButton =
              m.kind !== "continue" &&
              settings.translateEnabled &&
              (settings.translateScope === "all" || settings.translateScope === m.role);
            const autoShowTranslation =
              m.kind !== "continue" &&
              settings.translateEnabled &&
              settings.autoTranslateScope !== "none" &&
              (settings.autoTranslateScope === "all" || settings.autoTranslateScope === m.role);
            return (
              <Fragment key={m.id}>
                {/* Бит-продолжение (предыдущий ход — «Дальше» без директивы) отделяем орнаментом:
                    чипа-режиссёра между ними нет, иначе биты сливались бы. */}
                {m.kind === "beat" && messages[i - 1]?.kind === "continue" && <BeatDivider />}
                <StoryMessageItem
                  message={m}
                  isLast={m.id === lastBeatId && streamingText === null}
                  disabled={sending}
                  showTranslateButton={showTranslateButton}
                  targetLang={settings.translateTargetLang}
                  autoShowTranslation={autoShowTranslation}
                  autoTranslating={autoTranslatingIds.has(m.id)}
                  onTranslate={handleTranslate}
                  onRetranslate={handleRetranslate}
                  onDeleteTranslation={handleDeleteTranslation}
                  onRegenerate={() => regenerate(m.id)}
                  onDelete={() => handleDelete(m.id)}
                  onSwitchSibling={handleSwitch}
                />
              </Fragment>
            );
          })}

          {streamingText !== null && (
            <>
              {/* Стримящийся бит тоже отделяем, если двинули историю «Дальше» (последний ход — continue). */}
              {messages[messages.length - 1]?.kind === "continue" && <BeatDivider />}
              <div style={{ margin: "8px 0", whiteSpace: "pre-wrap", lineHeight: 1.5, color: "var(--tgui--text_color)" }}>
                {streamingText ? (
                  <RpText text={streamingText} />
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--tgui--hint_color)" }}>
                    <Spinner size="s" />
                    {statusPhase === "compacting" && "Сжимаю историю…"}
                  </span>
                )}
              </div>
            </>
          )}

          <div ref={bottomRef} />
        </div>

        <StoryInput
          ref={storyInputRef}
          onAdvance={advance}
          onTranslate={() => setTranslateOpen(true)}
          disabled={sending}
        />
      </div>

      <AnimatePresence>
        {translateOpen && (
          <TranslateSheet
            key="story-translate-sheet"
            translate={(p) => composeStoryTranslate(id, p)}
            langOptions={LANG_OPTIONS}
            onPick={(t) => {
              storyInputRef.current?.setDraft(t);
              setTranslateOpen(false);
            }}
            onClose={() => setTranslateOpen(false)}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
