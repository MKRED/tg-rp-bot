import { Spinner } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { chatGraphPath, chatSettingsPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { useChat, useChatSettings, useSendMessage } from "../../features/rp-chat";
import { deleteMessage, switchBranch, translateMessage } from "../../features/rp-chat/api/messages-api";
import { ChatHeader } from "../../features/rp-chat/components/ChatHeader";
import { ChatInput, type ChatInputHandle } from "../../features/rp-chat/components/ChatInput";
import { ImpersonateSheet } from "../../features/rp-chat/components/ImpersonateSheet";
import { TranslateSheet } from "../../features/rp-chat/components/TranslateSheet";
import { MessageBubble } from "../../features/rp-chat/components/MessageBubble";
import { StreamingBubble } from "../../features/rp-chat/components/StreamingBubble";
import type { MessageInPath } from "../../features/rp-chat";
import "./rp-chat.css";

const MSG_TRANSITION = { duration: 0.2, ease: "easeOut" as const };

export function RpChatPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);
  // Первый скролл к низу при загрузке чата — мгновенный (без видимой долгой прокрутки),
  // далее новые сообщения/стриминг скроллим плавно.
  const didInitialScroll = useRef(false);
  // Сообщения, для которых mount-анимация уже отыграла. Анимируем только реально новые
  // пузыри: иначе ремоунт хвоста (переключение ветки/правка) на длинной истории упирался
  // в delay = индекс × 30мс (до ~3с на 100 сообщениях) перед появлением.
  const animatedIds = useRef<Set<number>>(new Set());
  // Хранит ID сообщений, которые уже были видны — чтобы авто-переводить только новые.
  const seenMessageIds = useRef<Set<number>>(new Set());
  // Подавляет авто-перевод при смене ветки (сообщения исторические, не новые).
  const suppressNextAutoTranslate = useRef(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);

  const { chat, loading, error, refresh, setChat } = useChat(chatId);
  const { settings } = useChatSettings(chatId);

  const [editingId, setEditingId] = useState<number | null>(null);
  const editingMsg = editingId != null
    ? (chat?.messages.find((m) => m.id === editingId) ?? null)
    : null;

  const handleDone = useCallback((_u: MessageInPath | null, _a: MessageInPath) => { refresh(); setEditingId(null); }, [refresh]);

  // Добавляем сообщение пользователя в список сразу при получении SSE-события,
  // не дожидаясь завершения генерации и refresh().
  const handleOptimisticUserMessage = useCallback((msg: MessageInPath) => {
    setChat((prev) => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
  }, [setChat]);

  const { send, edit, regenerate, sending, streamingText } = useSendMessage(chatId, handleDone, handleOptimisticUserMessage);

  // Скролл вниз при новых сообщениях и стриминге.
  // Первый скролл (открытие чата) — мгновенный, чтобы не было долгой прокрутки от верха.
  useEffect(() => {
    if (!chat?.messages.length) return;
    const behavior = didInitialScroll.current ? "smooth" : "auto";
    messagesEndRef.current?.scrollIntoView({ behavior });
    didInitialScroll.current = true;
  }, [chat?.messages.length, streamingText]);

  // После коммита помечаем все текущие сообщения как «отанимированные», чтобы при
  // следующем рендере новыми считались только реально добавленные пузыри.
  useEffect(() => {
    for (const m of chat?.messages ?? []) animatedIds.current.add(m.id);
  }, [chat?.messages]);

  const handlePickSuggestion = (text: string) => {
    chatInputRef.current?.setDraft(text);
    setImpersonateOpen(false);
    setTranslateOpen(false);
  };

  const handleSend = (content: string) => {
    setImpersonateOpen(false); // момент диалога сменится — варианты больше не актуальны
    if (editingId != null) {
      // Оптимистично срезаем список с позиции редактируемого сообщения:
      // для user-сообщений — освобождаем место под новый сиблинг + ответ ИИ;
      // для assistant-сообщений — убираем само сообщение (вернётся после refresh).
      setChat((prev) => {
        if (!prev) return prev;
        const idx = prev.messages.findIndex((m) => m.id === editingId);
        if (idx === -1) return prev;
        return { ...prev, messages: prev.messages.slice(0, idx) };
      });
      edit(editingId, content);
    } else {
      send(content);
    }
  };

  const handleSwitchBranch = async (targetMessageId: number) => {
    setImpersonateOpen(false); // другой момент диалога
    // Сообщения новой ветки — историческими, авто-переводить не нужно.
    suppressNextAutoTranslate.current = true;
    await switchBranch(chatId, targetMessageId);
    refresh();
  };

  const handleTranslate = useCallback(async (messageId: number, lang: string): Promise<string> => {
    const translation = await translateMessage(chatId, messageId, lang);
    setChat((prev) =>
      prev
        ? {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === messageId
                ? { ...m, translations: { ...(m.translations ?? {}), [lang]: translation } }
                : m,
            ),
          }
        : prev,
    );
    return translation;
  }, [chatId, setChat]);

  // Убираем регенерируемое assistant-сообщение оптимистично — оно заменится
  // новым после завершения генерации и refresh(). User-сообщения не трогаем.
  const handleRegenerate = useCallback((msgId: number) => {
    if (sending) return;
    const msg = chat?.messages.find((m) => m.id === msgId);
    if (msg?.role === "assistant") {
      setChat((prev) => prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== msgId) } : prev);
    }
    regenerate(msgId);
  }, [chat, regenerate, sending, setChat]);

  const handleDeleteMessage = async (messageId: number) => {
    await deleteMessage(chatId, messageId);
    refresh();
  };

  // Авто-перевод новых сообщений согласно настройке autoTranslateScope.
  useEffect(() => {
    const msgs = chat?.messages;
    if (!msgs?.length) return;

    // Первая загрузка чата или смена ветки — помечаем всё как "видимое" без перевода.
    if (seenMessageIds.current.size === 0 || suppressNextAutoTranslate.current) {
      suppressNextAutoTranslate.current = false;
      seenMessageIds.current = new Set(msgs.map((m) => m.id));
      return;
    }

    const { autoTranslateScope, translateTargetLang, translateEnabled } = settings;
    if (!translateEnabled || autoTranslateScope === "none") {
      seenMessageIds.current = new Set(msgs.map((m) => m.id));
      return;
    }
    const newMsgs = msgs.filter((m) => !seenMessageIds.current.has(m.id));
    seenMessageIds.current = new Set(msgs.map((m) => m.id));
    for (const msg of newMsgs) {
      if (
        (autoTranslateScope === "all" || autoTranslateScope === msg.role) &&
        !msg.translations?.[translateTargetLang]
      ) {
        handleTranslate(msg.id, translateTargetLang).catch(() => {});
      }
    }
  }, [chat?.messages, settings, handleTranslate]);

  const lastAssistantId = [...(chat?.messages ?? [])].reverse().find((m) => m.role === "assistant")?.id;

  // Запрашивает ответ ИИ на текущий activeMessageId (может быть user или assistant).
  const handleGetResponse = useCallback(() => {
    if (chat?.activeMessageId) handleRegenerate(chat.activeMessageId);
  }, [chat?.activeMessageId, handleRegenerate]);

  // Индекс первого ещё не анимированного сообщения — от него отсчитываем каскад
  // (с потолком), чтобы новые пузыри появлялись быстро независимо от длины истории.
  const messages = chat?.messages ?? [];
  const firstNewIdx = messages.findIndex((m) => !animatedIds.current.has(m.id));

  return (
    <PageTransition>
      <div className="rp-chat-page">
        {chat && (
          <ChatHeader
            character={chat.character}
            onSettingsClick={() => navigate(chatSettingsPath(chatId))}
            onGraphClick={() => navigate(chatGraphPath(chatId))}
          />
        )}

        <div className="rp-chat-page__messages">
          {loading && (
            <div className="rp-chat-loading">
              <Spinner size="m" />
            </div>
          )}
          {!loading && error && (
            <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--tg-theme-hint-color)" }}>
              Не удалось загрузить чат
            </div>
          )}
          {!loading && !error && chat?.messages.length === 0 && !streamingText && (
            <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--tg-theme-hint-color)" }}>
              Напишите первое сообщение
            </div>
          )}

          {messages.map((msg: MessageInPath, i: number) => {
            const showTranslateButton =
              settings.translateEnabled &&
              (settings.translateScope === "all" || settings.translateScope === msg.role);
            const autoShowTranslation =
              settings.translateEnabled &&
              settings.autoTranslateScope !== "none" &&
              (settings.autoTranslateScope === "all" || settings.autoTranslateScope === msg.role);
            // Новый пузырь анимируется; каскад от первого нового, потолок 0.3с.
            const isNew = firstNewIdx >= 0 && !animatedIds.current.has(msg.id);
            const delay = isNew ? Math.min((i - firstNewIdx) * 0.03, 0.3) : 0;
            return (
              <motion.div
                key={msg.id}
                initial={isNew ? { opacity: 0, y: 12 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...MSG_TRANSITION, delay }}
              >
                <MessageBubble
                  message={msg}
                  showTranslateButton={showTranslateButton}
                  targetLang={settings.translateTargetLang}
                  autoShowTranslation={autoShowTranslation}
                  isLastAssistant={msg.id === lastAssistantId}
                  onSwitchBranch={handleSwitchBranch}
                  onTranslate={handleTranslate}
                  onEdit={(msgId) => setEditingId(msgId)}
                  onRegenerate={handleRegenerate}
                  onDelete={handleDeleteMessage}
                />
              </motion.div>
            );
          })}

          <AnimatePresence>
            {streamingText !== null && chat && (
              <motion.div
                key="streaming"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={MSG_TRANSITION}
              >
                <StreamingBubble text={streamingText} />
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        <div className="rp-chat-page__input">
          {editingMsg && (
            <div style={{
              fontSize: 12, color: "var(--tg-theme-hint-color)", padding: "0 4px 6px",
              display: "flex", gap: 8,
            }}>
              <span>Редактирование</span>
              <button
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--tg-theme-link-color)", fontSize: 12, padding: 0 }}
                onClick={() => setEditingId(null)}
                type="button"
              >
                Отмена
              </button>
            </div>
          )}
          <ChatInput
            ref={chatInputRef}
            onSend={handleSend}
            onGetResponse={handleGetResponse}
            onImpersonate={() => setImpersonateOpen(true)}
            onTranslate={() => setTranslateOpen(true)}
            disabled={sending}
          />
        </div>

        <AnimatePresence>
          {impersonateOpen && chat && (
            <ImpersonateSheet
              key="impersonate-sheet"
              chatId={chatId}
              targetLang={settings.translateTargetLang}
              onPick={handlePickSuggestion}
              onClose={() => setImpersonateOpen(false)}
            />
          )}
          {translateOpen && chat && (
            <TranslateSheet
              key="translate-sheet"
              chatId={chatId}
              onPick={handlePickSuggestion}
              onClose={() => setTranslateOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
