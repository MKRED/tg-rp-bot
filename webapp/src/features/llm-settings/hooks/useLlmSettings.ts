import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../../shared/toast";
import { getDeepSeekBalance, getLlmSettings, saveLlmSettings, verifyDeepSeekKey } from "../api/llm-settings-api";
import type { DeepSeekBalance, LlmSettingsStatus } from "../types/llmSettings";

const VERIFY_ERROR_MESSAGES: Record<string, string> = {
  invalid_key: "Ключ не принят DeepSeek — проверьте, что он скопирован полностью и без опечаток.",
  no_key: "Сначала введите ключ.",
};

/**
 * Состояние экрана «ИИ (DeepSeek)»: статус ключа приходит с сервера (одинаково на всех устройствах).
 * Модель здесь не выбирается — она живёт в пресете генерации. Ключ в поле ввода никогда не
 * префиллится значением с сервера (сервер его и не возвращает) — только last4 в подписи.
 */
export function useLlmSettings() {
  const [status, setStatus] = useState<LlmSettingsStatus>({ hasKey: false, last4: null });
  const [loading, setLoading] = useState(true);
  const [keyInput, setKeyInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState<DeepSeekBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const { showToast } = useToast();

  const refresh = useCallback(() => {
    setLoading(true);
    return getLlmSettings()
      .then(setStatus)
      .catch((err) => console.error("Failed to load LLM settings", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Молча — баланс информационный, отдельного тоста об ошибке не показываем (сама секция скрыта,
  // когда ключа нет, поэтому "no_key"/401 тут — гонка с ещё не осевшим статусом, не пользовательский ввод).
  // balanceRequestRef — счётчик поколения запроса: при быстрой смене/удалении ключа предыдущий
  // ещё летящий запрос может разрешиться позже нового и перезаписать state чужим (устаревшим)
  // балансом; применяем результат, только если это всё ещё последний запущенный запрос.
  const balanceRequestRef = useRef(0);
  const loadBalance = useCallback(async () => {
    const requestId = ++balanceRequestRef.current;
    setBalanceLoading(true);
    try {
      const result = await getDeepSeekBalance();
      if (balanceRequestRef.current === requestId) setBalance(result);
    } catch (err) {
      console.error("Failed to load DeepSeek balance", err);
      if (balanceRequestRef.current === requestId) setBalance(null);
    } finally {
      if (balanceRequestRef.current === requestId) setBalanceLoading(false);
    }
  }, []);

  // Зависимость от last4 (не всего status) — last4 меняется ровно при замене сохранённого ключа
  // на новый, поэтому баланс перезапрашивается на реально значимые события (появился/пропал/сменился
  // ключ), а не на каждый новый объект status с теми же hasKey/last4.
  useEffect(() => {
    if (status.hasKey) {
      void loadBalance();
    } else {
      balanceRequestRef.current++; // инвалидируем всё ещё летящий запрос для уже удалённого ключа
      setBalance(null);
      setBalanceLoading(false);
    }
  }, [status.hasKey, status.last4, loadBalance]);

  // Проверяет введённый ключ (или уже сохранённый, если поле пустое). Возвращает исход вызывающему
  // коду (verifyAndSave): сохраняем только ключ, который DeepSeek принял.
  const verify = useCallback(async (): Promise<boolean> => {
    setVerifying(true);
    try {
      const res = await verifyDeepSeekKey(keyInput.trim() || undefined);
      if (!res.ok) {
        showToast({
          type: "error",
          message: VERIFY_ERROR_MESSAGES[res.error ?? ""] ?? "Не удалось проверить ключ.",
        });
        return false;
      }
      showToast({ type: "success", message: `Ключ действителен, доступно моделей: ${res.models?.length ?? 0}` });
      return true;
    } catch (err) {
      console.error("Failed to verify DeepSeek key", err);
      showToast({ type: "error", message: "Не удалось проверить ключ. Попробуйте ещё раз." });
      return false;
    } finally {
      setVerifying(false);
    }
  }, [keyInput, showToast]);

  const save = useCallback(async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      setStatus(await saveLlmSettings({ apiKey: trimmed }));
      setKeyInput("");
    } catch (err) {
      console.error("Failed to save LLM settings", err);
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : "Не удалось сохранить настройки.",
      });
    } finally {
      setSaving(false);
    }
  }, [keyInput, showToast]);

  // Кнопка в after поля ввода: проверить новый ключ и сразу сохранить.
  const verifyAndSave = useCallback(async () => {
    if (await verify()) await save();
  }, [verify, save]);

  const clearKey = useCallback(async () => {
    setSaving(true);
    try {
      setStatus(await saveLlmSettings({ apiKey: null }));
      setKeyInput("");
    } catch (err) {
      console.error("Failed to clear DeepSeek key", err);
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
    clearKey,
    balance,
    balanceLoading,
  };
}
