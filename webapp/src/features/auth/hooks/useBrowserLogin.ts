import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../shared/api/client";
import { useToast } from "../../../shared/toast";
import { fetchSession, setCredentials } from "../api/auth-api";
import { normalizeLogin, validateCredentials } from "../lib/validateCredentials";

/**
 * Состояние секции «Вход в браузере» в настройках Mini App: задан ли логин (GET /api/auth/session —
 * в Telegram он отвечает по initData) и форма, которой аккаунт из Telegram задаёт логин и пароль.
 */
export function useBrowserLogin() {
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState<string | null>(null);
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    fetchSession()
      .then((session) => {
        if (!cancelled) setLogin(session.login);
      })
      .catch((err) => console.error("Failed to load auth session", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    const invalid = validateCredentials("register", { login: loginInput, password, repeat });
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const normalized = normalizeLogin(loginInput);
      await setCredentials({ login: normalized, password });
      setLogin(normalized);
      setPassword("");
      setRepeat("");
      showToast({ message: "Логин и пароль сохранены" });
    } catch (err) {
      // Сервер отдаёт готовый текст (логин занят, лимит попыток).
      setError(err instanceof ApiError ? err.message : "Не удалось связаться с сервером");
    } finally {
      setSaving(false);
    }
  }, [loginInput, password, repeat, showToast]);

  return { loading, login, loginInput, setLoginInput, password, setPassword, repeat, setRepeat, error, saving, save };
}
