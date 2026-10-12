import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "../../../shared/toast";
import { advanceStory, regenerateBeat, type StoryStreamEvents } from "../api/stories-api";
import type { StoryMessage } from "../types/story";

interface GenerationOptions {
  setMessages: Dispatch<SetStateAction<StoryMessage[]>>;
  /** Тихо перезапросить историю; onApplied — в том же батче, что и новая лента. Бросает при неудаче. */
  reload: (onApplied?: () => void) => Promise<void>;
  /** Готовый бит пришёл — до того, как он попадёт в ленту (лента не анимирует его появление). */
  onBeatDone?: (beat: StoryMessage) => void;
  /** Ход не дошёл до сервера (директива не появилась в ленте) — вернуть её текст в поле. */
  onDirectiveLost?: (directive: string) => void;
}

const NETWORK_ERROR = "Не удалось получить ответ — проверьте соединение и попробуйте ещё раз";

/** Чем кончилась генерация, если бит так и не пришёл. */
interface FailInfo {
  /** Ход пользователя (директива / «Дальше») уже в ленте. */
  userMessageShown: boolean;
}

/**
 * Генерация следующего бита: «Дальше»/директива и перегенерация последнего бита. Держит текст потока
 * (null — генерации нет), фазу фонового статуса перед битом (compacting — авто-сжатие) и флаг занятости.
 */
export function useStoryGeneration(
  storyId: number,
  { setMessages, reload, onBeatDone, onDirectiveLost }: GenerationOptions,
) {
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [statusPhase, setStatusPhase] = useState<string | null>(null);

  // Пересинхронизация после генерации. Поток снимаем в том же батче, что и новую ленту, — иначе лента
  // на миг укоротилась бы (скролл вверх) до прихода бита (скролл обратно вниз).
  const resync = useCallback(
    () =>
      reload(() => setStreamingText(null)).catch((err) => {
        console.error("Failed to reload story", err);
        showToast({ type: "error", message: "Не удалось обновить историю" });
      }),
    [reload, showToast],
  );

  const run = useCallback(
    async (start: (events: StoryStreamEvents) => Promise<void>, onFail: (info: FailInfo) => Promise<void> | void) => {
      setSending(true);
      setStreamingText("");
      let userMessageShown = false;
      let finished = false;
      // Пересинхронизацию дожидаемся до снятия sending: иначе новый ход, начатый пока reload в полёте,
      // получил бы поздний onApplied — тот оборвал бы его поток и затёр бы его директиву в ленте.
      let pending: Promise<void> | null = null;
      const fail = (message: string) => {
        if (finished) return;
        finished = true;
        setStatusPhase(null);
        setStreamingText(null);
        showToast({ type: "error", message });
        pending = Promise.resolve(onFail({ userMessageShown }));
      };
      try {
        await start({
          onUserMessage: (msg) => {
            userMessageShown = true;
            setMessages((prev) => [...prev, msg]);
          },
          onStatus: setStatusPhase,
          onToken: (text) => {
            setStatusPhase(null); // первый токен бита → фаза статуса (сжатие) завершена
            setStreamingText((prev) => (prev ?? "") + text);
          },
          onReset: () => setStreamingText(""), // ретрай на сервере: стираем плохой ответ
          onDone: (beat) => {
            finished = true;
            setStatusPhase(null);
            onBeatDone?.(beat);
            pending = resync();
          },
          onError: fail,
        });
        // Поток закрылся без done и без error (обрыв соединения посреди ответа) — бит не пришёл.
        if (!finished) fail(NETWORK_ERROR);
      } catch (err) {
        // Сетевое исключение (offline, обрыв) ридер SSE в onError не превращает — снимаем поток здесь.
        console.error("Story generation failed", err);
        fail(NETWORK_ERROR);
      } finally {
        await pending;
        setSending(false);
      }
    },
    [setMessages, showToast, onBeatDone, resync],
  );

  /** Пустая директива — «Дальше», иначе — режиссёрская директива. */
  const advance = useCallback(
    (directive: string) => {
      if (sending) return;
      void run(
        (events) => advanceStory(storyId, directive, events),
        ({ userMessageShown }) => {
          // Ход уже в ленте, а бит не пришёл — сверяемся с сервером, что у него осталось. Ход не дошёл —
          // набранная директива не должна пропасть.
          if (userMessageShown) return resync();
          if (directive) onDirectiveLost?.(directive);
        },
      );
    },
    [sending, run, storyId, resync, onDirectiveLost],
  );

  const regenerate = useCallback(
    (beatId: number) => {
      if (sending) return;
      // Перегенерируемый бит убираем сразу — его место займёт потоковый. Вернётся новым вариантом после
      // генерации; при ошибке — reload вернёт исходный (сервер откатил курсор).
      setMessages((prev) => prev.filter((m) => m.id !== beatId));
      void run(
        (events) => regenerateBeat(storyId, beatId, events),
        () => resync(),
      );
    },
    [sending, run, storyId, setMessages, resync],
  );

  return { advance, regenerate, sending, streamingText, statusPhase };
}
