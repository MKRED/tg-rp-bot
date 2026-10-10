import type { ToolDefinition } from "../llm/types.js";

export const WEB_SEARCH_TOOL_NAME = "web_search";

/** Схема инструмента для tool_choice: "auto" — модель сама решает, когда искать. */
export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: WEB_SEARCH_TOOL_NAME,
    description:
      "Searches the internet for up-to-date information (news, facts past the model's training cutoff, current details about a character/setting).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
};
