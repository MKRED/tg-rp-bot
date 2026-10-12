/** Публичная поверхность фичи narrator («Режиссёр истории»). */

export { useStories } from "./hooks/useStories";
export { useStory, type StoryLoadError } from "./hooks/useStory";
export { useStorySettings } from "./hooks/useStorySettings";
export { useStoryStats } from "./hooks/useStoryStats";
export { useCompactions } from "./hooks/useCompactions";
export { useStoryTranslation } from "./hooks/useStoryTranslation";
export { useStoryGeneration } from "./hooks/useStoryGeneration";
export { useStoryTree } from "./hooks/useStoryTree";
export { StoryAvatars } from "./components/StoryAvatars";
export { StoryRow } from "./components/StoryRow";
export { StoryInput, type StoryInputHandle } from "./components/StoryInput";
export { StoryHeader } from "./components/StoryHeader";
export { StoryMessageItem } from "./components/StoryMessageItem";
export { StoryFeed, type StoryFeedHandle } from "./components/StoryFeed";
export {
  StoryCompactCard,
  StoryFeedCard,
  StoryLinksCard,
  StoryStatsCard,
  type StoryLinkTarget,
} from "./components/StorySettings";
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
  editStoryBeat,
  translateStoryMessage,
  deleteStoryTranslation,
  composeStoryTranslate,
  type StoryStreamEvents,
} from "./api/stories-api";
export { getStorySettings, updateStorySettings } from "./api/settings-api";
export { getStoryStats } from "./api/stats-api";
export { compactStory, listCompactions, deleteCompaction } from "./api/compact-api";
export { LANG_OPTIONS, SCOPE_OPTIONS, AUTO_SCOPE_OPTIONS } from "./lib/translate-options";
export { storyTranslateFlags } from "./lib/storyMessages";
export type {
  StoryListItem,
  StoryMessage,
  StoryMessageKind,
  StoryTreeNode,
  StoryDetail,
  StoryCreateInput,
  StorySettings,
  StoryStats,
  StoryCompaction,
  StoryAvatarRef,
} from "./types/story";
