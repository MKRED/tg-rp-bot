import { useCallback, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { chatGraphPath, chatSettingsPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { FullHeightPage } from "../../shared/components/FullHeightPage";
import { TranslateSheet } from "../../shared/components/TranslateSheet";
import { useToast } from "../../shared/toast";
import {
  ChatFeed,
  ChatHeader,
  ChatInput,
  ImpersonateSheet,
  LANG_OPTIONS,
  MessageBubble,
  composeTranslate,
  deleteMessage,
  switchBranch,
  useChat,
  useChatSettings,
  useChatTranslation,
  translateFlags,
  useSendMessage,
  type ChatFeedHandle,
  type ChatInputHandle,
  type MessageInPath,
} from "../../features/rp-chat";

/** Экран RP-чата: шапка, лента сообщений, поле ввода, шторки «ответ от вашего лица» и перевода. */
export function RpChatPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();
  const feedRef = useRef<ChatFeedHandle>(null);
  const inputRef = useRef<ChatInputHandle>(null);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { chat, loading, error, refresh, setChat } = useChat(chatId);
  const { settings } = useChatSettings(chatId);
  const { translate, retranslate, removeTranslation, autoTranslatingIds, suppressAutoTranslate } = useChatTranslation(
    chatId,
    chat,
    setChat,
    settings,
  );

  const handleDone = useCallback(
    (_user: MessageInPath | null, assistant: MessageInPath, commit: () => void) => {
      // Готовый ответ подменяет потоковый пузырь — без анимации появления (мелькание текста). commit
      // гасит стрим в том же коммите, где refresh влил ответ в ленту, — лента не схлопывается.
      feedRef.current?.markAnimated(assistant.id);
      refresh(commit).catch((err) => console.error("Failed to refresh chat", err));
      setEditingId(null);
    },
    [refresh],
  );

  // Своё сообщение — в ленту сразу по событию сервера, не дожидаясь ответа ИИ.
  const handleUserMessage = useCallback(
    (msg: MessageInPath) => setChat((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev)),
    [setChat],
  );

  const { send, edit, regenerate, sending, streamingText } = useSendMessage(chatId, handleDone, handleUserMessage);

  const messages = chat?.messages ?? [];
  // Не findLast: ES2023, сборка — es2022 (методы не транспилируются), а WebView Telegram бывают старыми.
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  const handleSend = (content: string) => {
    setImpersonateOpen(false); // момент диалога сменится — варианты больше не к месту
    if (editingId === null) {
      void send(content);
      return;
    }
    // Срезаем ленту с правимого сообщения: для своего — место под новый вариант и ответ ИИ, для ответа
    // ИИ — убираем его самого (вернётся после refresh).
    setChat((prev) => {
      if (!prev) return prev;
      const idx = prev.messages.findIndex((m) => m.id === editingId);
      return idx === -1 ? prev : { ...prev, messages: prev.messages.slice(0, idx) };
    });
    void edit(editingId, content);
  };

  const startEdit = (messageId: number) => {
    setEditingId(messageId);
    // Текст сообщения — в поле: правим, а не набираем заново.
    const msg = messages.find((m) => m.id === messageId);
    if (msg) inputRef.current?.setDraft(msg.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    inputRef.current?.setDraft("");
  };

  const handleSwitchBranch = async (targetId: number) => {
    setImpersonateOpen(false); // другой момент диалога
    suppressAutoTranslate(); // сообщения ветки исторические — не автопереводим
    try {
      await switchBranch(chatId, targetId);
      await refresh();
    } catch (err) {
      console.error("Failed to switch branch", err);
      showToast({ type: "error", message: "Не удалось переключить вариант" });
    }
  };

  // Перегенерируемый ответ ИИ убираем сразу — его место займёт потоковый пузырь. Своё сообщение не трогаем.
  const handleRegenerate = (messageId: number) => {
    if (sending) return;
    const msg = messages.find((m) => m.id === messageId);
    if (msg?.role === "assistant") {
      setChat((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== messageId) } : prev));
    }
    void regenerate(messageId);
  };

  // Пустое поле + кнопка — ответ ИИ на последнее сообщение ветки (своё или его же — тогда новый вариант).
  const handleGetResponse = () => {
    if (chat?.activeMessageId) handleRegenerate(chat.activeMessageId);
  };

  const handleDelete = async (messageId: number) => {
    try {
      await deleteMessage(chatId, messageId);
      await refresh();
    } catch (err) {
      console.error("Failed to delete message", err);
      showToast({ type: "error", message: "Не удалось удалить сообщение" });
    }
  };

  const pickDraft = (text: string) => {
    inputRef.current?.setDraft(text);
    setImpersonateOpen(false);
    setTranslateOpen(false);
  };

  return (
    <FullHeightPage>
      {chat && (
        <ChatHeader
          character={chat.character}
          title={chat.title}
          onSettingsClick={() => navigate(chatSettingsPath(chatId))}
          onGraphClick={() => navigate(chatGraphPath(chatId))}
        />
      )}

      <ChatFeed
        ref={feedRef}
        chatId={chatId}
        messages={messages}
        loading={loading}
        error={error && !chat}
        streamingText={streamingText}
        renderMessage={(msg) => {
          const flags = translateFlags(settings, msg.role);
          return (
            <MessageBubble
              message={msg}
              showTranslateButton={flags.button}
              targetLang={settings.translateTargetLang}
              autoShowTranslation={flags.autoShow}
              autoTranslating={autoTranslatingIds.has(msg.id)}
              isLastAssistant={msg.id === lastAssistantId}
              onSwitchBranch={handleSwitchBranch}
              onTranslate={translate}
              onRetranslate={retranslate}
              onDeleteTranslation={removeTranslation}
              onEdit={startEdit}
              onRegenerate={handleRegenerate}
              onDelete={handleDelete}
            />
          );
        }}
      />

      {chat && (
        <ChatInput
          ref={inputRef}
          onSend={handleSend}
          onGetResponse={handleGetResponse}
          onImpersonate={() => setImpersonateOpen(true)}
          onTranslate={() => setTranslateOpen(true)}
          editing={editingId !== null}
          onCancelEdit={cancelEdit}
          disabled={sending}
        />
      )}

      <ImpersonateSheet
        opened={impersonateOpen}
        chatId={chatId}
        targetLang={settings.translateTargetLang}
        onPick={pickDraft}
        onClose={() => setImpersonateOpen(false)}
      />
      <TranslateSheet
        opened={translateOpen}
        translate={(p) => composeTranslate(chatId, p)}
        langOptions={LANG_OPTIONS}
        onPick={pickDraft}
        onClose={() => setTranslateOpen(false)}
      />
    </FullHeightPage>
  );
}
