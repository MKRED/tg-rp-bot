import { Banner, Button, Caption, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { ROUTES, presetEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import {
  usePresets,
  PresetMonogram,
  presetSummary,
  MAX_PRESETS_PER_USER,
} from "../../features/generation-presets";
import "./presets.css";

/**
 * Хаб «Настройки ответа ИИ»: все пресеты генерации + кнопка создания. Страница НЕ скроллится
 * целиком — две секции в одном List: секция списка растянута на всю высоту (скролл ВНУТРИ её
 * карточки), секция кнопки докнута к нижней кромке (тот же приём, что в хабе «Персонажи»/«Книги знаний»).
 */
export function PresetsListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = usePresets();

  const atLimit = items.length >= MAX_PRESETS_PER_USER;

  return (
    <PageTransition>
      <div className="presets-hub">
        <Banner
          type="section"
          before={<SlidersHorizontal size={28} className="presets-hub__banner-icon" />}
          header="Настройки ответа ИИ"
          description="Пресеты генерации: креативность, длина и стиль ответов"
        />

        <List className="presets-hub__list">
          {/* Section вставляет Divider между прямыми детьми по позиции — единственное top-level
              выражение (тернарник) не даёт паразитных пустых слотов между loading/error/пусто;
              для списка ветка возвращает items.map(...) НЕ обёрнутым во Fragment, чтобы Section
              развернул его как массив и расставил разделители между карточками. */}
          <Section className="presets-hub__list-section">
            {loading ? (
              <div className="presets-hub__center">
                <Spinner size="m" />
              </div>
            ) : error ? (
              <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>
            ) : items.length === 0 ? (
              <Cell subtitle="Пока нет пресетов — создайте первый">Пусто</Cell>
            ) : (
              items.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2, ease: "easeOut" }}
                >
                  <Cell
                    before={<PresetMonogram id={p.id} name={p.name} />}
                    subtitle={presetSummary(p)}
                    onClick={() => navigate(presetEditPath(p.id))}
                  >
                    {p.name}
                  </Cell>
                </motion.div>
              ))
            )}
          </Section>

          {/* Вторая секция — кнопка создания. Один div-ребёнок: Section вставляет Divider между
              несколькими детьми, а тут нужен цельный блок без разделителя. */}
          <Section className="presets-hub__actions-section">
            <div className="presets-hub__create">
              <Button
                size="l"
                stretched
                disabled={atLimit}
                onClick={() => navigate(ROUTES.presetNew)}
              >
                + Создать пресет
              </Button>
              {atLimit && (
                <Caption level="1" className="presets-hub__limit">
                  Достигнут лимит в {MAX_PRESETS_PER_USER} пресетов
                </Caption>
              )}
            </div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
