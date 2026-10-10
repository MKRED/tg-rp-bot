import { Button, Caption, Input, List, Section, Title } from "@telegram-apps/telegram-ui";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../../shared/api/client";
import { login, register } from "../api/auth-api";
import { type AuthFormMode, normalizeLogin, validateCredentials } from "../lib/validateCredentials";
import "./AuthScreen.css";

interface AuthScreenProps {
  /** Вход или регистрация прошли — cookie сессии уже стоит, gate перечитывает сессию. */
  onAuthenticated: () => void;
}

/** Экран входа и регистрации для браузера (в Telegram не показывается — там вход по initData). */
export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthFormMode>("login");
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  const switchMode = () => {
    setMode(isRegister ? "login" : "register");
    setError(null);
    setRepeat("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = validateCredentials(mode, { login: loginValue, password, repeat });
    if (invalid) {
      setError(invalid);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const credentials = { login: normalizeLogin(loginValue), password };
      await (isRegister ? register(credentials) : login(credentials));
      onAuthenticated();
    } catch (err) {
      // Сервер отдаёт готовый текст (логин занят, неверный логин или пароль, лимит попыток).
      setError(err instanceof ApiError ? err.message : "Не удалось связаться с сервером");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-screen__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <Title level="1" weight="2" className="auth-screen__title">
          {isRegister ? "Регистрация" : "Вход"}
        </Title>
        <List>
          <Section
            footer={
              isRegister ? (
                <Caption level="1" className="auth-screen__hint">
                  Восстановить пароль можно будет только через привязанный Telegram — запомните его.
                </Caption>
              ) : undefined
            }
          >
            <Input
              header="Логин"
              placeholder="login"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
            />
            <Input
              header="Пароль"
              type="password"
              placeholder="••••••••"
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {isRegister && (
              <Input
                header="Повторите пароль"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            )}
          </Section>
        </List>
        {error && (
          <Caption level="1" className="auth-screen__error" role="alert">
            {error}
          </Caption>
        )}
        <Button type="submit" size="l" stretched loading={submitting}>
          {isRegister ? "Зарегистрироваться" : "Войти"}
        </Button>
        <Button type="button" mode="plain" size="m" stretched onClick={switchMode} disabled={submitting}>
          {isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </Button>
      </form>
    </div>
  );
}
