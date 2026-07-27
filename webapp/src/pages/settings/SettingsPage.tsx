import { Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { LlmSettingsSection, useLlmSettings } from "../../features/llm-settings";
import { PageTransition } from "../../shared/components/PageTransition";
import { ThemeToggle } from "../../shared/theme";
import "./settings.css";

const ITEM_T = { duration: 0.2, ease: "easeOut" as const };

/**
 * Экран «Настройки»: тема оформления и персональный ключ/модель ИИ (DeepSeek).
 *
 * Статус ключа (useLlmSettings) грузится на уровне страницы: пока не пришёл ответ, показываем
 * один спиннер на весь экран вместо частичного контента — иначе секция «ИИ» появлялась бы позже
 * темы и сдвигала бы уже отрисованный список.
 */
export function SettingsPage() {
  const { loading, ...llm } = useLlmSettings();

  if (loading) {
    return (
      <PageTransition>
        <div className="settings-page settings-page__loading">
          <Spinner size="l" />
        </div>
      </PageTransition>
    );
  }

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

          <LlmSettingsSection {...llm} />
        </List>
      </div>
    </PageTransition>
  );
}
