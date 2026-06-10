/**
 * Публичная поверхность фичи «персоны» — то, что потребляют страницы.
 * Внутрифичевые модули импортируют друг друга напрямую по файлам, НЕ через этот barrel
 * (иначе цикл, который компилируется, но даёт undefined в рантайме).
 */
export { PersonaAvatar } from "./components/PersonaAvatar";
export { PersonaForm } from "./components/PersonaForm";
export { usePersonas } from "./hooks/usePersonas";
export { usePersona } from "./hooks/usePersona";
export {
  getPersona,
  createPersona,
  updatePersona,
  removePersona,
} from "./api/personas-api";
export type { Persona, PersonaInput, PersonaListItem } from "./types/persona";
export { MAX_PERSONAS_PER_USER } from "./types/persona";
