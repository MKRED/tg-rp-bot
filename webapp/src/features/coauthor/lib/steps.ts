import type { CoauthorCard, CoauthorStep } from "../types/coauthor";

/** Подпись шага хода: пока идёт — что ИИ делает, потом — что сделано. */
export function stepLabel(step: CoauthorStep, cards: CoauthorCard[]): string {
  const running = step.status === "running";
  switch (step.kind) {
    case "cards":
      return running ? "Смотрит список карточек" : "Просмотрен список карточек";
    case "card": {
      const name = cards.find((c) => c.id === step.cardId)?.name ?? "карточка убрана из чата";
      return `${running ? "Читает карточку" : "Прочитана карточка"}: ${name}`;
    }
    case "search":
      return `${running ? "Ищет в интернете" : "Поиск"}: «${step.query}»`;
    case "edit": {
      const card = cards.find((c) => c.id === step.cardId);
      const block = card?.blocks.find((b) => b.id === step.blockId);
      // Карточку могли убрать из чата после этого хода — старый шаг остаётся без названий.
      const target = card && block ? `${card.name} · ${block.title}` : (card?.name ?? "блок удалён");
      return `${running ? "Пишет правку" : "Правка"}: ${target}`;
    }
  }
}
