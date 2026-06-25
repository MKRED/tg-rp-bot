// Баррел домена narrator-историй: публичная поверхность для server/*.

export type { StoryInput, StoryMessageInPath, StoryDetail, StoryListItem } from "./types.js";

export { listStories, getStory, createStory, renameStory, updateStoryPremise, deleteStory } from "./stories.js";

export {
  insertStoryMessage,
  getStoryMessage,
  updateActiveStoryMessage,
  setActiveStoryMessage,
  deleteStoryMessage,
} from "./messages.js";
