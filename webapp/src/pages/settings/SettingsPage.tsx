import { Button, Group, Stack, Text } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { BrowserLoginSection, useAuth, useBrowserLogin } from "../../features/auth";
import { LlmSettingsSection, useLlmSettings } from "../../features/llm-settings";
import { TranslateSettingsSection, useTranslateSettings } from "../../features/translate-settings";
import { useWebSearchSettings, WebSearchSettingsSection } from "../../features/web-search-settings";
import { AppPage } from "../../shared/components/AppPage";
import { SettingsCard } from "../../shared/components/SettingsCard";
import { FontPicker, PalettePicker, ThemeToggle } from "../../shared/theme";

/** Подпись и пояснение над группой выбора (не <label>: подписывать нечего, у групп свой aria-label). */
function AppearanceField({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <div>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
      </div>
      {children}
    </Stack>
  );
}

/**
 * Экран «Настройки»: оформление (тема, палитра, шрифты), аккаунт (выход в браузере / логин для браузера в Mini App),
 * персональный ключ ИИ (DeepSeek), лимит веб-поиска, дефолты перевода в редакторе промптов.
 *
 * Статусы грузятся на уровне страницы: пока не пришли все ответы, AppPage показывает один лоадер
 * вместо частичного контента — иначе карточки появлялись бы по очереди и сдвигали уже отрисованные.
 */
export function SettingsPage() {
  const { loading: llmLoading, ...llm } = useLlmSettings();
  const { loading: webSearchLoading, ...webSearch } = useWebSearchSettings();
  const { loading: translateLoading, ...translate } = useTranslateSettings();
  const { mode, session, logout } = useAuth();
  const { loading: browserLoginLoading, ...browserLogin } = useBrowserLogin();
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <AppPage title="Настройки" loading={llmLoading || webSearchLoading || translateLoading || browserLoginLoading}>
      <SettingsCard title="Оформление" description="Сохраняется на этом устройстве.">
        <AppearanceField label="Тема" description="«Авто» — светлая или тёмная, как в Telegram.">
          <ThemeToggle />
        </AppearanceField>
        <AppearanceField label="Палитра">
          <PalettePicker />
        </AppearanceField>
        <AppearanceField label="Шрифты">
          <FontPicker />
        </AppearanceField>
      </SettingsCard>

      {/* Аккаунт — только в браузере: в Telegram вход по initData, выходить не из чего. */}
      {mode === "browser" && (
        <SettingsCard title="Аккаунт">
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text fw={500}>{session?.displayName ?? "Вход по логину"}</Text>
              {session?.login && (
                <Text size="sm" c="dimmed">
                  Логин: {session.login}
                </Text>
              )}
            </div>
            <Button
              variant="default"
              loading={loggingOut}
              onClick={() => {
                setLoggingOut(true);
                logout().catch(() => setLoggingOut(false));
              }}
            >
              Выйти
            </Button>
          </Group>
        </SettingsCard>
      )}

      {/* «Вход в браузере» — в Mini App; в браузере у аккаунта логин уже есть (кроме локального
          dev-обхода — там карточка тоже видна, чтобы её можно было проверить вне Telegram). */}
      {(mode === "telegram" || !browserLogin.login) && <BrowserLoginSection {...browserLogin} />}

      <LlmSettingsSection {...llm} />
      <WebSearchSettingsSection {...webSearch} />
      <TranslateSettingsSection {...translate} />
    </AppPage>
  );
}
