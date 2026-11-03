import { useCards } from "../../features/cards";
import type { CoauthorCardOption, CoauthorPresetOption } from "../../features/coauthor";
import { presetSummary, usePresets } from "../../features/generation-presets";

/**
 * Карточки и пресеты для формы чата соавтора. Фича coauthor не тянет чужие фичи сама (границы фич) —
 * списки подтягивают и маппят страницы, как у формы карточки.
 */
export function useCoauthorFormOptions() {
  const { items: rawCards, loading: cardsLoading } = useCards();
  const { items: rawPresets, loading: presetsLoading } = usePresets();
  const cards: CoauthorCardOption[] = rawCards.map((c) => ({ id: c.id, name: c.name }));
  const presets: CoauthorPresetOption[] = rawPresets.map((p) => ({ id: p.id, name: p.name, summary: presetSummary(p) }));
  return { cards, cardsLoading, presets, presetsLoading };
}
