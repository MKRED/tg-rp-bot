/**
 * Публичная поверхность фичи «Соавтор» — то, что потребляют страницы.
 * Внутрифичевые модули импортируют друг друга напрямую по файлам, НЕ через этот barrel.
 */
export { CoauthorWorkspace } from "./components/CoauthorWorkspace";
export { CoauthorChatForm } from "./components/CoauthorChatForm";
export { useCoauthorChats } from "./hooks/useCoauthorChats";
export { useCoauthorChat } from "./hooks/useCoauthorChat";
export {
  createCoauthorChat,
  updateCoauthorChat,
  removeCoauthorChat,
  clearCoauthorChat,
} from "./api/coauthor-api";
export { coauthorErrorMessage } from "./lib/errors";
export type {
  CoauthorCardOption,
  CoauthorChat,
  CoauthorChatInput,
  CoauthorChatListItem,
  CoauthorPresetOption,
} from "./types/coauthor";
export { MAX_COAUTHOR_CARDS, MAX_COAUTHOR_CHATS_PER_USER } from "./types/coauthor";
