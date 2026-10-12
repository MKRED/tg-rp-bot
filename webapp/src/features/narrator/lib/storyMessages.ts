import type { StoryMessage, StorySettings } from "../types/story";

/** Кладёт перевод сообщения в ленту (или убирает его при text = null). Остальные языки не трогает. */
export function withStoryTranslation(
  messages: StoryMessage[],
  messageId: number,
  lang: string,
  text: string | null,
): StoryMessage[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m;
    const { [lang]: _old, ...rest } = m.translations ?? {};
    return { ...m, translations: text === null ? rest : { ...rest, [lang]: text } };
  });
}

/**
 * Кнопка перевода на сообщении и сразу ли показывать перевод (автоперевод) — по настройкам истории.
 * Роль assistant — бит, user — директива; технические «Дальше» (continue) не переводятся.
 */
export function storyTranslateFlags(settings: StorySettings, message: Pick<StoryMessage, "role" | "kind">) {
  const { translateEnabled, translateScope, autoTranslateScope } = settings;
  const on = translateEnabled && message.kind !== "continue";
  return {
    button: on && (translateScope === "all" || translateScope === message.role),
    autoShow: on && (autoTranslateScope === "all" || autoTranslateScope === message.role),
  };
}

/** Перед битом стоит «Дальше» без директивы — бит отделяем орнаментом, иначе он слился бы с предыдущим. */
export function followsContinue(messages: StoryMessage[], index: number): boolean {
  return messages[index - 1]?.kind === "continue";
}
