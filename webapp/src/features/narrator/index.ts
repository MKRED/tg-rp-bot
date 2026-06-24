/** Публичная поверхность фичи narrator («Режиссёр истории»). */

export { useStories } from "./hooks/useStories";
export { useStory } from "./hooks/useStory";
export { StoryInput } from "./components/StoryInput";
export { StoryMessageItem } from "./components/StoryMessageItem";
export {
  listStories,
  getStory,
  createStory,
  renameStory,
  removeStory,
  advanceStory,
  regenerateBeat,
  switchBranch,
  deleteStoryMessage,
  type StoryStreamEvents,
} from "./api/stories-api";
export type {
  StoryListItem,
  StoryMessage,
  StoryMessageKind,
  StoryDetail,
  StoryCreateInput,
} from "./types/story";
