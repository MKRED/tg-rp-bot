/**
 * RP-разметка ↔ HTML для Яндекс-перевода. В format=text Яндекс портит *действия*: съедает `*` в начале
 * текста и ставит пробел после открывающей (`* I wonder…*`) — курсив в RpText ломается. В format=html
 * курсив <i>…</i> он переносит на место перевода, поэтому звёздочки уходят тегами и возвращаются
 * обратно. Свои `& < >` экранируем, иначе Яндекс принял бы их за разметку.
 */

/**
 * Действие *…* в пределах одной строки, как курсив в Markdown: внутри нет звёздочек, первый и последний
 * символ — не пробел. Иначе `** * одна` дало бы курсив из одного пробела, а обратная замена его съела бы.
 */
const ACTION = /\*(?![\s*])([^*\n]*?[^\s*])\*/g;

export function toYandexHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(ACTION, "<i>$1</i>");
}

/** Обратно: <i>…</i> → *…* (пробелы у краёв курсива — внутрь звёздочек не тащим), сущности → символы. */
export function fromYandexHtml(html: string): string {
  const marked = html.replace(/<i>[ \t]*/g, "*").replace(/[ \t]*<\/i>/g, "*");
  return marked
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}
