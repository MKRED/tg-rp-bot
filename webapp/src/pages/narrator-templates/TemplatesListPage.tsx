import { Banner, Button, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { ScrollText } from "lucide-react";
import { motion } from "framer-motion";
import { ROUTES, narratorTemplateEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { MAX_TEMPLATES_PER_USER, useTemplates } from "../../features/narrator-templates";
import "./narrator-templates.css";

/**
 * Хаб «Narrator-шаблоны»: все шаблоны + кнопка создания. Страница НЕ скроллится целиком —
 * две секции в одном List: секция списка растянута на всю высоту (скролл ВНУТРИ её карточки),
 * секция кнопки докнута к нижней кромке (тот же приём, что в хабе «Персонажи»/«Книги знаний»).
 */
export function TemplatesListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useTemplates();
  const atLimit = items.length >= MAX_TEMPLATES_PER_USER;

  return (
    <PageTransition>
      <div className="nt-hub">
        <Banner
          type="section"
          before={<ScrollText size={28} className="nt-hub__banner-icon" />}
          header="Narrator-шаблоны"
          description="Инструкция нарратора для режима «Режиссёр истории»"
        />

        <List className="nt-hub__list">
          {/* Section вставляет Divider между прямыми детьми по позиции — единственное top-level
              выражение (тернарник) не даёт паразитных пустых слотов между loading/error/пусто;
              для списка ветка возвращает items.map(...) НЕ обёрнутым во Fragment, чтобы Section
              развернул его как массив и расставил разделители между карточками. */}
          <Section className="nt-hub__list-section">
            {loading ? (
              <div className="nt-hub__center">
                <Spinner size="m" />
              </div>
            ) : error ? (
              <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>
            ) : items.length === 0 ? (
              <Cell subtitle="Пока нет шаблонов — создайте первый">Пусто</Cell>
            ) : (
              items.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2, ease: "easeOut" }}
                >
                  <Cell
                    before={<ScrollText size={24} />}
                    onClick={() => navigate(narratorTemplateEditPath(t.id))}
                  >
                    {t.name}
                  </Cell>
                </motion.div>
              ))
            )}
          </Section>

          {/* Вторая секция — кнопка создания. Один div-ребёнок: Section вставляет Divider между
              несколькими детьми, а тут нужен цельный блок без разделителя. */}
          <Section className="nt-hub__actions-section">
            <div className="nt-hub__create">
              <Button
                size="l"
                stretched
                disabled={atLimit}
                onClick={() => navigate(ROUTES.narratorTemplateNew)}
              >
                + Создать шаблон
              </Button>
            </div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
