import type { StoryPromptComponentId } from "../../db/schema.js";

export const MAX_TEMPLATES_PER_USER = 50;

// Канонический набор narrator-компонентов — promptOrder обязан содержать ровно их (по разу).
export const STORY_PROMPT_COMPONENT_IDS: StoryPromptComponentId[] = [
  "system",
  "premise",
  "lorebook",
  "auxiliary",
  "history",
  "postHistory",
];
