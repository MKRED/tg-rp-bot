import type { PromptComponentId } from "../../db/schema.js";

// Мягкий лимит (дублируется в webapp для блокировки UI — здесь последняя линия защиты).
export const MAX_RP_TEMPLATES_PER_USER = 50;

// Канонический набор компонентов RP-запроса — promptOrder обязан содержать ровно их (по разу).
export const PROMPT_COMPONENT_IDS: PromptComponentId[] = [
  "system",
  "characterDescription",
  "characterScenario",
  "userDescription",
  "auxiliary",
  "history",
  "postHistory",
];
