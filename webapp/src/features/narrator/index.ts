/** Публичная поверхность фичи narrator («Режиссёр истории»). */

export { useStories } from "./hooks/useStories";
export { useStory } from "./hooks/useStory";
export { useStorySettings } from "./hooks/useStorySettings";
export { useStoryStats } from "./hooks/useStoryStats";
export { useCompactions } from "./hooks/useCompactions";
export { useStoryAutoTranslate } from "./hooks/useStoryAutoTranslate";
export { useStoryTree } from "./hooks/useStoryTree";
export { StoryCard } from "./components/StoryCard";
export { StoryInput, type StoryInputHandle } from "./components/StoryInput";
export { StoryHeader } from "./components/StoryHeader";
export { StoryMessageItem } from "./components/StoryMessageItem";
export { BeatDivider } from "./components/BeatDivider";
export { CompactSettingsSection } from "./components/CompactSettingsSection";
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
  deleteStoryTranslation,
  composeStoryTranslate,
  type StoryStreamEvents,
} from "./api/stories-api";
export { getStorySettings, updateStorySettings } from "./api/settings-api";
export { getStoryStats } from "./api/stats-api";
export { compactStory, listCompactions, deleteCompaction } from "./api/compact-api";
export { LANG_OPTIONS, SCOPE_OPTIONS, AUTO_SCOPE_OPTIONS, METHOD_OPTIONS } from "./lib/translate-options";
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
} from "./types/story";
