import { Button, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { ScrollText } from "lucide-react";
import { motion } from "framer-motion";
import { ROUTES, narratorTemplateEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { MAX_TEMPLATES_PER_USER, useTemplates } from "../../features/narrator-templates";
import "./narrator-templates.css";

/** Экран «Narrator-шаблоны»: список + кнопка создания. */
export function TemplatesListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useTemplates();
  const atLimit = items.length >= MAX_TEMPLATES_PER_USER;

  return (
    <PageTransition>
      <div className="nt-page">
        <List>
          <Section header="Narrator-шаблоны" footer="Инструкция нарратора для режима «Режиссёр истории»">
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Spinner size="m" />
              </div>
            )}
            {!loading && error && <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>}
            {!loading && !error && items.length === 0 && (
              <Cell subtitle="Пока нет шаблонов — создайте первый">Пусто</Cell>
            )}
            {!loading &&
              !error &&
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
              ))}
          </Section>
          <div style={{ padding: 16 }}>
            <Button
              size="l"
              stretched
              disabled={atLimit}
              onClick={() => navigate(ROUTES.narratorTemplateNew)}
            >
              + Создать шаблон
            </Button>
          </div>
        </List>
      </div>
    </PageTransition>
  );
}
