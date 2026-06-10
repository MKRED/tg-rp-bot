/**
 * Публичная поверхность фичи «настройки ответа ИИ» (пресеты генерации) — то, что нужно страницам.
 * Внутрифичевые модули импортируют друг друга напрямую по файлам, НЕ через этот barrel
 * (иначе цикл, который компилируется, но даёт undefined в рантайме).
 */
export { PresetMonogram } from "./components/PresetMonogram";
export { PresetForm } from "./components/PresetForm";
export { usePresets } from "./hooks/usePresets";
export { usePreset } from "./hooks/usePreset";
export {
  getPreset,
  createPreset,
  updatePreset,
  removePreset,
} from "./api/presets-api";
export { presetSummary } from "./lib/preset-summary";
export type { Preset, PresetInput } from "./types/preset";
export { MAX_PRESETS_PER_USER } from "./types/preset";
