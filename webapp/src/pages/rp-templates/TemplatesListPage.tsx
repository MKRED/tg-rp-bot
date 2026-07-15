import { Banner, Button, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { FileText } from "lucide-react";
import { motion } from "framer-motion";
import { ROUTES, rpTemplateEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { MAX_RP_TEMPLATES_PER_USER, useRpTemplates } from "../../features/rp-templates";
import "./rp-templates.css";

/**
 * Хаб «RP-шаблоны»: все шаблоны + кнопка создания. Страница НЕ скроллится целиком —
 * две секции в одном List: секция списка растянута на всю высоту (скролл ВНУТРИ её карточки),
 * секция кнопки докнута к нижней кромке (тот же приём, что в хабе «Narrator-шаблоны»).
 */
export function TemplatesListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useRpTemplates();
  const atLimit = items.length >= MAX_RP_TEMPLATES_PER_USER;

  return (
    <PageTransition>
      <div className="rpt-hub">
        <Banner
          type="section"
          before={<FileText size={28} className="rpt-hub__banner-icon" />}
          header="RP-шаблоны"
          description="Промпты и порядок их сборки для RP-чата"
        />

        <List className="rpt-hub__list">
          {/* Section вставляет Divider между прямыми детьми по позиции — единственное top-level
              выражение (тернарник) не даёт паразитных пустых слотов между loading/error/пусто;
              для списка ветка возвращает items.map(...) НЕ обёрнутым во Fragment, чтобы Section
              развернул его как массив и расставил разделители между карточками. */}
          <Section className="rpt-hub__list-section">
            {loading ? (
              <div className="rpt-hub__center">
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
                    before={<FileText size={24} />}
                    onClick={() => navigate(rpTemplateEditPath(t.id))}
                  >
                    {t.name}
                  </Cell>
                </motion.div>
              ))
            )}
          </Section>

          {/* Вторая секция — кнопка создания. Один div-ребёнок: Section вставляет Divider между
              несколькими детьми, а тут нужен цельный блок без разделителя. */}
          <Section className="rpt-hub__actions-section">
            <div className="rpt-hub__create">
              <Button
                size="l"
                stretched
                disabled={atLimit}
                onClick={() => navigate(ROUTES.rpTemplateNew)}
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
