import { SlidersHorizontal } from "lucide-react";
import { ROUTES, presetEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import {
  usePresets,
  PresetMonogram,
  presetSummary,
  MAX_PRESETS_PER_USER,
} from "../../features/generation-presets";
import { ListRow } from "../../shared/components/ListCard";
import { ListPage } from "../../shared/components/ListPage";

/** Хаб «Настройки ответа ИИ»: все пресеты генерации и создание нового. */
export function PresetsListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = usePresets();

  return (
    <ListPage
      title="Настройки ответа ИИ"
      description="Пресеты генерации: креативность, длина и стиль ответов"
      icon={SlidersHorizontal}
      loading={loading}
      error={error}
      count={items.length}
      limit={MAX_PRESETS_PER_USER}
      limitText={`Достигнут лимит в ${MAX_PRESETS_PER_USER} пресетов`}
      createLabel="Создать пресет"
      emptyTitle="Пока нет пресетов"
      emptyDescription="Пресет — набор параметров генерации: длина контекста и ответа, температура, рассуждение."
      onCreate={() => navigate(ROUTES.presetNew)}
    >
      {items.map((p, i) => (
        <ListRow
          key={p.id}
          index={i}
          leading={<PresetMonogram id={p.id} name={p.name} />}
          title={p.name}
          description={presetSummary(p)}
          onClick={() => navigate(presetEditPath(p.id))}
        />
      ))}
    </ListPage>
  );
}
