import { Button, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { InfoRow } from "../../../shared/components/InfoRow";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import type { useBrowserLogin } from "../hooks/useBrowserLogin";

type BrowserLoginSectionProps = Omit<ReturnType<typeof useBrowserLogin>, "loading">;

/**
 * Карточка настроек Mini App «Вход в браузере»: аккаунт из Telegram задаёт логин и пароль, чтобы
 * открывать приложение и вне Telegram (тот же аккаунт и данные). Логин задаётся один раз; после —
 * только показываем его и адрес для входа. Состояние (useBrowserLogin) поднято в SettingsPage.
 */
export function BrowserLoginSection({
  login,
  loginInput,
  setLoginInput,
  password,
  setPassword,
  repeat,
  setRepeat,
  error,
  saving,
  save,
}: BrowserLoginSectionProps) {
  // Mini App открыта с того же домена, что и браузерная версия, — адрес для входа и есть origin.
  const siteUrl = window.location.origin;

  if (login) {
    return (
      <SettingsCard title="Вход в браузере" description={`Входите на ${siteUrl} с этим логином и паролем.`}>
        <InfoRow label="Логин" value={login} />
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Вход в браузере"
      description={`Задайте логин и пароль, чтобы открывать приложение в обычном браузере (${siteUrl}) — с тем же аккаунтом и данными. Логин задаётся один раз.`}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        noValidate
      >
        <Stack gap="sm">
          <TextInput
            label="Логин"
            placeholder="login"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={loginInput}
            onChange={(e) => setLoginInput(e.currentTarget.value)}
          />
          <PasswordInput
            label="Пароль"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <PasswordInput
            label="Повторите пароль"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.currentTarget.value)}
          />
          {error && (
            <Text size="sm" c="red" role="alert">
              {error}
            </Text>
          )}
          <Button type="submit" fullWidth loading={saving} mt="xs">
            Сохранить
          </Button>
        </Stack>
      </form>
    </SettingsCard>
  );
}
