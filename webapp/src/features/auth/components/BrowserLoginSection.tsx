import { Button, Caption, Cell, Input, Section } from "@telegram-apps/telegram-ui";
import { FieldHint } from "../../../shared/components/FieldHint";
import { SectionActions } from "../../../shared/components/SectionActions";
import type { useBrowserLogin } from "../hooks/useBrowserLogin";
import "./BrowserLoginSection.css";

type BrowserLoginSectionProps = Omit<ReturnType<typeof useBrowserLogin>, "loading">;

/**
 * Секция настроек Mini App «Вход в браузере»: аккаунт из Telegram задаёт логин и пароль, чтобы
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
      <Section header="Вход в браузере">
        <Cell subtitle={`Входите на ${siteUrl} с этим логином и паролем`}>Логин: {login}</Cell>
      </Section>
    );
  }

  return (
    <Section className="section-blend-inputs" header="Вход в браузере">
      <FieldHint>
        Задайте логин и пароль, чтобы открывать приложение в обычном браузере ({siteUrl}) — с тем же
        аккаунтом и данными. Логин задаётся один раз.
      </FieldHint>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        noValidate
      >
        <Input
          header="Логин"
          placeholder="login"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={loginInput}
          onChange={(e) => setLoginInput(e.target.value)}
        />
        <Input
          header="Пароль"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          header="Повторите пароль"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
        {error && (
          <Caption level="1" className="browser-login__error" role="alert">
            {error}
          </Caption>
        )}
        <SectionActions>
          <Button type="submit" size="m" stretched loading={saving}>
            Сохранить
          </Button>
        </SectionActions>
      </form>
    </Section>
  );
}
