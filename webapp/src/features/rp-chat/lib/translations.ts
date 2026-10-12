import type { ChatDetail, ChatSettings, MessageInPath } from "../types/chat";

/** Кладёт перевод сообщения в ленту (или убирает его при text = null). Остальные языки не трогает. */
export function withTranslation(
  chat: ChatDetail | null,
  messageId: number,
  lang: string,
  text: string | null,
): ChatDetail | null {
  if (!chat) return chat;
  return {
    ...chat,
    messages: chat.messages.map((m) => {
      if (m.id !== messageId) return m;
      const { [lang]: _old, ...rest } = m.translations ?? {};
      return { ...m, translations: text === null ? rest : { ...rest, [lang]: text } };
    }),
  };
}

/** Кнопка перевода на сообщении этой роли и сразу ли показывать перевод (автоперевод) — по настройкам чата. */
export function translateFlags(settings: ChatSettings, role: MessageInPath["role"]) {
  const { translateEnabled, translateScope, autoTranslateScope } = settings;
  return {
    button: translateEnabled && (translateScope === "all" || translateScope === role),
    autoShow: translateEnabled && (autoTranslateScope === "all" || autoTranslateScope === role),
  };
}
