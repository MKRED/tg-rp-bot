import { Cell, List, Section } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { PageTransition } from "../../shared/components/PageTransition";
import { ThemeToggle } from "../../shared/theme";
import "./settings.css";

const ITEM_T = { duration: 0.2, ease: "easeOut" as const };

/** Экран «Настройки»: тема оформления и (в перспективе) персональные ключи API ИИ. */
export function SettingsPage() {
  return (
    <PageTransition>
      <div className="settings-page">
        <List>
          <Section header="Оформление">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={ITEM_T}>
              <Cell subtitle="По умолчанию — как в Telegram" after={<ThemeToggle />}>
                Тема
              </Cell>
            </motion.div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
