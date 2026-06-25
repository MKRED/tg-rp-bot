import { Spinner } from "@telegram-apps/telegram-ui";
import { Fragment, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { storySettingsPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { RpText } from "../../shared/components/RpText";
import {
  BeatDivider,
  StoryHeader,
  StoryInput,
  StoryMessageItem,
  advanceStory,
  deleteStoryMessage,
  regenerateBeat,
  switchBranch,
  useStory,
} from "../../features/narrator";
import { confirmAction } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";
import type { StoryMessage } from "../../features/narrator";
import "./narrator.css";

/** Экран истории: лента битов + директив, поле режиссёра, стриминг следующего бита. */
export function StoryPage() {
  const params = useParams();
  const id = Number(params.id);

  const navigate = useTransitionNavigate();
  const { story, messages, setMessages, loading, error, reload } = useStory(id);
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Автопрокрутка к низу при новых сообщениях/стриминге.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const lastBeatId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  const advance = (directive: string) => {
    if (sending) return;
    setSending(true);
    setStreamingText("");
    advanceStory(id, directive, {
      onUserMessage: (msg: StoryMessage) => setMessages((prev) => [...prev, msg]),
      onToken: (text) => setStreamingText((prev) => (prev ?? "") + text),
      onReset: () => setStreamingText(""),
      onDone: () => {
        setStreamingText(null);
        reload();
      },
      onError: () => {
        setStreamingText(null);
        showToast({ type: "error", message: "Не удалось продолжить историю" });
      },
    }).finally(() => {
      setSending(false);
      setStreamingText(null);
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
      onDone: () => {
        setStreamingText(null);
        reload();
      },
      onError: () => {
        setStreamingText(null);
        showToast({ type: "error", message: "Не удалось перегенерировать бит" });
        reload(); // вернуть оптимистично убранный бит (сервер откатил курсор на исходный)
      },
    }).finally(() => {
      setSending(false);
      setStreamingText(null);
    });
  };

  const handleDelete = async (msgId: number) => {
    if (sending) return;
    const confirmed = await confirmAction("Удалить этот бит и всё, что после него?");
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
          onSettingsClick={() => navigate(storySettingsPath(id))}
        />

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px", display: "flex", flexDirection: "column" }}>
          {messages.map((m, i) => (
            <Fragment key={m.id}>
              {/* Бит-продолжение (предыдущий ход — «Дальше» без директивы) отделяем орнаментом:
                  чипа-режиссёра между ними нет, иначе биты сливались бы. */}
              {m.kind === "beat" && messages[i - 1]?.kind === "continue" && <BeatDivider />}
              <StoryMessageItem
                message={m}
                isLast={m.id === lastBeatId && streamingText === null}
                disabled={sending}
                onRegenerate={() => regenerate(m.id)}
                onDelete={() => handleDelete(m.id)}
                onSwitchSibling={handleSwitch}
              />
            </Fragment>
          ))}

          {streamingText !== null && (
            <>
              {/* Стримящийся бит тоже отделяем, если двинули историю «Дальше» (последний ход — continue). */}
              {messages[messages.length - 1]?.kind === "continue" && <BeatDivider />}
              <div style={{ margin: "8px 0", whiteSpace: "pre-wrap", lineHeight: 1.5, color: "var(--tgui--text_color)" }}>
                {streamingText ? <RpText text={streamingText} /> : <Spinner size="s" />}
              </div>
            </>
          )}

          <div ref={bottomRef} />
        </div>

        <StoryInput onAdvance={advance} disabled={sending} />
      </div>
    </PageTransition>
  );
}
