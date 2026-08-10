import { Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { LlmSettingsSection, useLlmSettings } from "../../features/llm-settings";
import { TavilySettingsSection, useTavilySettings } from "../../features/tavily-settings";
import { TranslateSettingsSection, useTranslateSettings } from "../../features/translate-settings";
import { PageTransition } from "../../shared/components/PageTransition";
import { ThemeToggle } from "../../shared/theme";
import "./settings.css";

const ITEM_T = { duration: 0.2, ease: "easeOut" as const };

/**
 * Экран «Настройки»: тема оформления, персональные ключи ИИ (DeepSeek) + веб-поиска (Tavily) и
 * дефолты режима перевода полноэкранного редактора промптов (PromptEditorOverlay).
 *
 * Статусы (useLlmSettings/useTavilySettings/useTranslateSettings) грузятся на уровне страницы:
 * пока не пришли все ответы, показываем один спиннер на весь экран вместо частичного контента —
 * иначе секции появлялись бы позже темы и сдвигали бы уже отрисованный список.
 */
export function SettingsPage() {
  const { loading: llmLoading, ...llm } = useLlmSettings();
  const { loading: tavilyLoading, ...tavily } = useTavilySettings();
  const { loading: translateLoading, ...translate } = useTranslateSettings();

  if (llmLoading || tavilyLoading || translateLoading) {
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
          <TavilySettingsSection {...tavily} />
          <TranslateSettingsSection {...translate} />
        </List>
      </div>
    </PageTransition>
  );
}
