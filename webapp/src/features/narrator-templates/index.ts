/** Публичная поверхность фичи «narrator-шаблоны». */

export { useTemplates } from "./hooks/useTemplates";
export { useTemplate } from "./hooks/useTemplate";
export { TemplateForm } from "./components/TemplateForm";
export {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  removeTemplate,
} from "./api/templates-api";
export type {
  NarratorTemplate,
  NarratorTemplateInput,
  NarratorTemplateListItem,
} from "./types/template";
export { MAX_TEMPLATES_PER_USER } from "./types/template";
