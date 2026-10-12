import type { useLongPress } from "../../../../shared/hooks/useLongPress";

/** Кнопка перевода на бите или директиве: состояние и обработчики из StoryMessageItem. */
export interface TranslateControl {
  /** Сейчас показан перевод. */
  active: boolean;
  /** Идёт перевод (по кнопке, автоперевод, «заново» или удаление). */
  pending: boolean;
  onToggle: () => void;
  /** Есть кэш перевода — долгое нажатие открывает «перевести заново / удалить». */
  longPress?: ReturnType<typeof useLongPress>;
}
