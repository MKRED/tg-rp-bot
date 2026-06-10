/**
 * Публичная поверхность фичи «персонажи» — то, что потребляют страницы.
 * Внутрифичевые модули импортируют друг друга напрямую по файлам, НЕ через этот barrel
 * (иначе цикл, который компилируется, но даёт undefined в рантайме).
 */
export { CharacterAvatar } from "./components/CharacterAvatar";
export { CharacterForm } from "./components/CharacterForm";
export { useCharacters } from "./hooks/useCharacters";
export { useCharacter } from "./hooks/useCharacter";
export {
  getCharacter,
  createCharacter,
  updateCharacter,
  removeCharacter,
} from "./api/characters-api";
export type { Character, CharacterInput, CharacterListItem } from "./types/character";
export { MAX_CHARACTERS_PER_USER } from "./types/character";
