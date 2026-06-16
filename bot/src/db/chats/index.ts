// Баррел домена чатов: публичная поверхность для server/*.
// Раскладка по обязанностям: types / queries (общий path-CTE) / chats / messages / settings / crypto.

export type {
  ChatInput,
  MessageInPath,
  ChatDetail,
  ChatListItem,
  TreeNode,
  ChatTokenStats,
  ChatSettingsRow,
} from "./types.js";

export {
  listChats,
  getChat,
  getChatTree,
  createChat,
  deleteChat,
} from "./chats.js";

export {
  insertMessage,
  getMessage,
  updateActiveMessage,
  setActiveMessage,
  deleteMessage,
  saveTranslation,
} from "./messages.js";

export { getChatSettings, upsertChatSettings } from "./settings.js";

export { getChatTokenStats } from "./stats.js";
