/** Публичная поверхность фичи narrator («Режиссёр истории»). */

export { useRecentStories } from "./hooks/useRecentStories";
export { useAllStories } from "./hooks/useAllStories";
export { useStory } from "./hooks/useStory";
export { StoryCard } from "./components/StoryCard";
export { StoryInput } from "./components/StoryInput";
export { StoryMessageItem } from "./components/StoryMessageItem";
export { BeatDivider } from "./components/BeatDivider";
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
