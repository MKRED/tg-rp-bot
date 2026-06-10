import { Button, Caption, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";
import { ROUTES, presetEditPath } from "../../app/routes";
import { usePresets } from "../../features/generation-presets/usePresets";
import { PresetMonogram } from "../../features/generation-presets/PresetMonogram";
import { presetSummary } from "../../features/generation-presets/preset-summary";
import { MAX_PRESETS_PER_USER } from "../../features/generation-presets/types";
import "./presets.css";

/** Экран «Настройки ответа ИИ»: список пресетов генерации + кнопка создания. */
export function PresetsListPage() {
  const navigate = useNavigate();
  const { items, loading, error } = usePresets();

  const atLimit = items.length >= MAX_PRESETS_PER_USER;

  return (
    <div className="presets-page">
      <List>
        <Section header="Настройки ответа ИИ">
          {loading && (
            <div className="presets-page__center">
              <Spinner size="m" />
            </div>
          )}

          {!loading && error && <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>}

          {!loading && !error && items.length === 0 && (
            <Cell subtitle="Пока нет пресетов — создайте первый">Пусто</Cell>
          )}

          {!loading &&
            !error &&
            items.map((p) => (
              <Cell
                key={p.id}
                before={<PresetMonogram id={p.id} name={p.name} />}
                subtitle={presetSummary(p)}
                onClick={() => navigate(presetEditPath(p.id))}
              >
                {p.name}
              </Cell>
            ))}
        </Section>

        <div className="presets-page__create">
          <Button
            size="l"
            stretched
            disabled={atLimit}
            onClick={() => navigate(ROUTES.presetNew)}
          >
            + Создать пресет
          </Button>
          {atLimit && (
            <Caption level="1" className="presets-page__limit">
              Достигнут лимит в {MAX_PRESETS_PER_USER} пресетов
            </Caption>
          )}
        </div>
      </List>
    </div>
  );
}
