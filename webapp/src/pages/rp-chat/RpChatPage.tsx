import { Spinner } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { chatGraphPath, chatSettingsPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { useChat, useChatSettings, useSendMessage } from "../../features/rp-chat";
import { switchBranch, translateMessage } from "../../features/rp-chat/api/index";
import { ChatHeader } from "../../features/rp-chat/components/ChatHeader";
import { ChatInput } from "../../features/rp-chat/components/ChatInput";
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

  const { chat, loading, error, refresh, setChat } = useChat(chatId);
  const { settings } = useChatSettings(chatId);

  const [editingId, setEditingId] = useState<number | null>(null);
  const editingMsg = editingId != null
    ? (chat?.messages.find((m) => m.id === editingId) ?? null)
    : null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDone = useCallback((_u: MessageInPath | null, _a: MessageInPath) => { refresh(); setEditingId(null); }, [refresh]);
  const { send, edit, regenerate, sending, streamingText } = useSendMessage(chatId, handleDone);

  // Скролл вниз при новых сообщениях и стриминге
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages.length, streamingText]);

  const handleSend = (content: string) => {
    if (editingId != null) { edit(editingId, content); } else { send(content); }
  };

  const handleSwitchBranch = async (targetMessageId: number) => {
    await switchBranch(chatId, targetMessageId);
    refresh();
  };

  const handleTranslate = async (messageId: number, lang: string): Promise<string> => {
    const translation = await translateMessage(chatId, messageId, lang);
    if (chat) {
      setChat({
        ...chat,
        messages: chat.messages.map((m) =>
          m.id === messageId
            ? { ...m, translations: { ...(m.translations ?? {}), [lang]: translation } }
            : m,
        ),
      });
    }
    return translation;
  };

  const lastAssistantId = [...(chat?.messages ?? [])].reverse().find((m) => m.role === "assistant")?.id;

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
            <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
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

          {chat?.messages.map((msg: MessageInPath, i: number) => {
            const showTranslateButton =
              settings.translateEnabled &&
              (settings.translateScope === "all" || settings.translateScope === msg.role);
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                // Stagger только при первой загрузке (loading только что стало false)
                transition={{ ...MSG_TRANSITION, delay: i * 0.03 }}
              >
                <MessageBubble
                  message={msg}
                  character={chat.character}
                  showTranslateButton={showTranslateButton}
                  targetLang={settings.translateTargetLang}
                  isLastAssistant={msg.id === lastAssistantId}
                  onSwitchBranch={handleSwitchBranch}
                  onTranslate={handleTranslate}
                  onEdit={(msgId) => setEditingId(msgId)}
                  onRegenerate={(msgId) => regenerate(msgId)}
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
                <StreamingBubble text={streamingText} character={chat.character} />
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
          <ChatInput onSend={handleSend} disabled={sending} />
        </div>
      </div>
    </PageTransition>
  );
}
