/** Публичная поверхность фичи «RP-шаблоны». */

export { useRpTemplates } from "./hooks/useRpTemplates";
export { useRpTemplate } from "./hooks/useRpTemplate";
export { TemplateForm } from "./components/TemplateForm";
export {
  listRpTemplates,
  getRpTemplate,
  createRpTemplate,
  updateRpTemplate,
  removeRpTemplate,
} from "./api/rp-templates-api";
export type { RpTemplate, RpTemplateInput, RpTemplateListItem } from "./types/template";
export { MAX_RP_TEMPLATES_PER_USER } from "./types/template";
