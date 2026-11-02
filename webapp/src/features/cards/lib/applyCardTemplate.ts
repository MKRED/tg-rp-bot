import type { CardCategory, CardField } from "@tg-rp-bot/shared";

/** Результат наложения полей шаблона на категории карточки + что пользователю показать в подтверждении. */
export interface TemplateApplyPlan {
  categories: CardCategory[];
  /** Поля, у которых сгенерированный текст сохранится (совпали по названию). */
  kept: string[];
  /** Поля карточки, которых нет в шаблоне, — удалятся вместе со своим текстом. */
  lostWithText: string[];
}

const titleKey = (title: string) => title.trim().toLowerCase();

/**
 * Накладывает поля шаблона на категории карточки. Поле шаблона забирает категорию с тем же названием
 * (без учёта регистра) — её id, текст и контекст инструментов (ответы ask_user, веб-поиски сервер
 * переносит по id), а название, пример и вкл/выкл берёт из шаблона. Каждая категория достаётся не
 * больше чем одному полю: два одноимённых поля шаблона иначе получили бы один id, и сервер отказал
 * бы (duplicate id). Пустое название не совпадает ни с чем. Остальные поля шаблона — новые пустые
 * категории со свежим id: id шаблона мог бы совпасть с id уже занятой категории.
 */
export function applyCardTemplate(
  current: CardCategory[],
  fields: CardField[],
  newId: () => string,
): TemplateApplyPlan {
  const unused = [...current];
  const kept: string[] = [];

  const categories = fields.map((field): CardCategory => {
    const key = titleKey(field.title);
    const matchIndex = key === "" ? -1 : unused.findIndex((c) => titleKey(c.title) === key);
    const { title, description, enabled } = field;
    if (matchIndex === -1) return { id: newId(), title, description, enabled, content: "" };
    const [match] = unused.splice(matchIndex, 1);
    if (match!.content.trim() !== "") kept.push(title);
    return { ...match!, title, description, enabled };
  });

  const lostWithText = unused.filter((c) => c.content.trim() !== "").map((c) => c.title || "Без названия");
  return { categories, kept, lostWithText };
}

/** Нативный попап Telegram обрезает сообщение длиннее 256 символов — списки полей сокращаем. */
const POPUP_MESSAGE_MAX = 256;

function shortList(titles: string[]): string {
  const shown = titles.slice(0, 3).join(", ");
  return titles.length > 3 ? `${shown} и ещё ${titles.length - 3}` : shown;
}

/** Текст подтверждения смены шаблона: что заменится, у каких полей текст сохранится, какой пропадёт. */
export function templateConfirmMessage(plan: TemplateApplyPlan): string {
  const parts = ["Системный промпт, поля и инструменты заменятся шаблонными."];
  if (plan.kept.length > 0) parts.push(`Текст сохранится: ${shortList(plan.kept)}.`);
  if (plan.lostWithText.length > 0) parts.push(`Удалится вместе с текстом: ${shortList(plan.lostWithText)}.`);
  const message = parts.join(" ");
  return message.length > POPUP_MESSAGE_MAX ? `${message.slice(0, POPUP_MESSAGE_MAX - 1)}…` : message;
}
