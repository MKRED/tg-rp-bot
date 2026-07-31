import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../../shared/toast";
import { getTavilySettings, saveTavilySettings, verifyTavilyKey } from "../api/tavily-settings-api";
import type { TavilySettingsStatus, TavilyUsage } from "../types/tavilySettings";

const VERIFY_ERROR_MESSAGES: Record<string, string> = {
  invalid_key: "Ключ не принят Tavily — проверьте, что он скопирован полностью и без опечаток.",
  no_key: "Сначала введите ключ.",
};

/**
 * Состояние экрана «Веб-поиск (Tavily)»: статус ключа приходит с сервера (одинаково на всех
 * устройствах), квота — эфемерная, обновляется через verify() (у Tavily нет отдельного эндпоинта
 * верификации — валидный ответ GET /usage сам по себе означает валидный ключ). Ключ в поле ввода
 * никогда не префиллится значением с сервера — только last4 в подписи.
 */
export function useTavilySettings() {
  const [status, setStatus] = useState<TavilySettingsStatus>({ hasKey: false, last4: null });
  const [loading, setLoading] = useState(true);
  const [keyInput, setKeyInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<TavilyUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const { showToast } = useToast();

  const refresh = useCallback(() => {
    setLoading(true);
    return getTavilySettings()
      .then(setStatus)
      .catch((err) => console.error("Failed to load Tavily settings", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Проверяет введённый ключ (или уже сохранённый, если поле пустое) и заодно обновляет квоту.
  // usageRequestRef — счётчик поколения запроса: при быстрой смене/удалении ключа предыдущий ещё
  // летящий запрос может разрешиться позже нового и перезаписать state чужой (устаревшей) квотой;
  // применяем результат, только если это всё ещё последний запущенный запрос.
  // silent — без тостов вообще (ни успеха, ни ошибки) и без setVerifying: используется при
  // автоподгрузке квоты на входе на экран, где неверный/отозванный сохранённый ключ — штатное
  // состояние (Cell сама покажет "Не удалось загрузить", как и баланс DeepSeek), а не результат
  // пользовательского ввода. Собственный usageLoading (не общий с verifying) — иначе фоновый
  // silent-запрос при заходе на экран держал бы disabled кнопку save/delete в поле ввода все время
  // своего полёта (как и у DeepSeek: verifying — для ручного действия, balanceLoading — для фона).
  const usageRequestRef = useRef(0);
  const verify = useCallback(async (opts?: { silent?: boolean }): Promise<{ ok: true } | { ok: false }> => {
    const requestId = ++usageRequestRef.current;
    if (opts?.silent) setUsageLoading(true);
    else setVerifying(true);
    try {
      const res = await verifyTavilyKey(keyInput.trim() || undefined);
      if (usageRequestRef.current !== requestId) return { ok: false };
      if (!res.ok) {
        setUsage(null);
        if (!opts?.silent) {
          showToast({
            type: "error",
            message: VERIFY_ERROR_MESSAGES[res.error ?? ""] ?? "Не удалось проверить ключ.",
          });
        }
        return { ok: false };
      }
      setUsage(res.usage ?? null);
      if (!opts?.silent) {
        showToast({ type: "success", message: "Ключ действителен." });
      }
      return { ok: true };
    } catch (err) {
      console.error("Failed to verify Tavily key", err);
      if (usageRequestRef.current === requestId && !opts?.silent) {
        showToast({ type: "error", message: "Не удалось проверить ключ. Попробуйте ещё раз." });
      }
      return { ok: false };
    } finally {
      if (usageRequestRef.current === requestId) {
        if (opts?.silent) setUsageLoading(false);
        else setVerifying(false);
      }
    }
  }, [keyInput, showToast]);

  // Зависимость от last4 (не всего status) — last4 меняется ровно при замене сохранённого ключа
  // на новый, поэтому квота перезапрашивается на реально значимые события (появился/пропал/сменился
  // ключ).
  useEffect(() => {
    if (status.hasKey) {
      void verify({ silent: true });
    } else {
      usageRequestRef.current++; // инвалидируем всё ещё летящий запрос для уже удалённого ключа
      setUsage(null);
      setUsageLoading(false);
    }
  }, [status.hasKey, status.last4]); // eslint-disable-line react-hooks/exhaustive-deps -- verify зависит от keyInput (меняется на каждый ввод), а перезапрашивать квоту нужно только при смене сохранённого ключа

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const trimmed = keyInput.trim();
      const res = await saveTavilySettings({ ...(trimmed && { apiKey: trimmed }) });
      setStatus(res);
      setKeyInput("");
    } catch (err) {
      console.error("Failed to save Tavily settings", err);
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : "Не удалось сохранить настройки.",
      });
    } finally {
      setSaving(false);
    }
  }, [keyInput, showToast]);

  // Комбо для кнопки в after поля ввода: проверить новый ключ и сразу сохранить.
  const verifyAndSave = useCallback(async () => {
    const result = await verify();
    if (result.ok) await save();
  }, [verify, save]);

  const clearKey = useCallback(async () => {
    setSaving(true);
    try {
      setStatus(await saveTavilySettings({ apiKey: null }));
      setKeyInput("");
      setUsage(null);
    } catch (err) {
      console.error("Failed to clear Tavily key", err);
      showToast({ type: "error", message: "Не удалось удалить ключ." });
    } finally {
      setSaving(false);
    }
  }, [showToast]);

  return {
    status,
    loading,
    keyInput,
    setKeyInput,
    verifying,
    verifyAndSave,
    saving,
    usage,
    usageLoading,
    clearKey,
  };
}
