import { Button, Paper, PasswordInput, SegmentedControl, Stack, Text, TextInput, Title } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../../../shared/api/client";
import { AppPage } from "../../../../shared/components/AppPage";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import { login, register } from "../../api/auth-api";
import { type AuthFormMode, normalizeLogin, validateCredentials } from "../../lib/validateCredentials";
import styles from "./LoginScreen.module.css";

/** Узкая колонка: форма из трёх полей на ПК не растягивается на 680px. */
const FORM_WIDTH = 440;

const MODE_OPTIONS = [
  { value: "login", label: "Вход" },
  { value: "register", label: "Регистрация" },
];

interface LoginScreenProps {
  /** Вход или регистрация прошли — cookie сессии уже стоит, gate перечитывает сессию. */
  onAuthenticated: () => void;
}

/** Экран входа и регистрации в браузере (маршрут /login; в Telegram не показывается — там вход по initData). */
export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<AuthFormMode>("login");
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  const switchMode = (next: string) => {
    setMode(next as AuthFormMode);
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
      setSubmitting(false);
    }
  };

  return (
    <AppPage width={FORM_WIDTH} centered>
      <Title order={2} ta="center">
        {isRegister ? "Регистрация" : "Вход"}
      </Title>
      <Paper withBorder p="lg" component="form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <Stack>
          <SegmentedControl fullWidth data={MODE_OPTIONS} value={mode} onChange={switchMode} disabled={submitting} />
          <TextInput
            label="Логин"
            placeholder="login"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={loginValue}
            onChange={(e) => setLoginValue(e.currentTarget.value)}
          />
          <PasswordInput
            label="Пароль"
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          {/* Повтор пароля и подсказка выезжают при переключении на регистрацию. Отрицательный
              margin компенсирует gap Stack, пока блок свёрнут. */}
          <AnimatePresence initial={false}>
            {isRegister && (
              <motion.div
                key="register"
                className={styles.collapse}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={MOTION_TRANSITION}
              >
                <Stack className={styles.registerFields}>
                  <PasswordInput
                    label="Повторите пароль"
                    autoComplete="new-password"
                    value={repeat}
                    onChange={(e) => setRepeat(e.currentTarget.value)}
                  />
                  <Text size="sm" c="dimmed">
                    Восстановить пароль можно будет только через привязанный Telegram — запомните его.
                  </Text>
                </Stack>
              </motion.div>
            )}
          </AnimatePresence>
          {error && (
            <Text size="sm" c="red" role="alert">
              {error}
            </Text>
          )}
          <Button type="submit" fullWidth loading={submitting}>
            {isRegister ? "Зарегистрироваться" : "Войти"}
          </Button>
        </Stack>
      </Paper>
    </AppPage>
  );
}
