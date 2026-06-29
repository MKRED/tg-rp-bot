/** Публичная поверхность фичи narrator («Режиссёр истории»). */

export { useRecentStories } from "./hooks/useRecentStories";
export { useAllStories } from "./hooks/useAllStories";
export { useStory } from "./hooks/useStory";
export { useStorySettings } from "./hooks/useStorySettings";
export { useStoryStats } from "./hooks/useStoryStats";
export { useStoryAutoTranslate } from "./hooks/useStoryAutoTranslate";
export { useStoryTree } from "./hooks/useStoryTree";
export { StoryCard } from "./components/StoryCard";
export { StoryInput } from "./components/StoryInput";
export { StoryHeader } from "./components/StoryHeader";
export { StoryMessageItem } from "./components/StoryMessageItem";
export { BeatDivider } from "./components/BeatDivider";
export {
  listStories,
  getStory,
  createStory,
  renameStory,
  updateStoryPremise,
  removeStory,
  advanceStory,
  regenerateBeat,
  switchBranch,
  deleteStoryMessage,
  translateStoryMessage,
  type StoryStreamEvents,
} from "./api/stories-api";
export { getStorySettings, updateStorySettings } from "./api/settings-api";
export { getStoryStats } from "./api/stats-api";
export { LANG_OPTIONS, SCOPE_OPTIONS, AUTO_SCOPE_OPTIONS } from "./lib/translate-options";
export type {
  StoryListItem,
  StoryMessage,
  StoryMessageKind,
  StoryTreeNode,
  StoryDetail,
  StoryCreateInput,
  StorySettings,
  StoryStats,
} from "./types/story";
