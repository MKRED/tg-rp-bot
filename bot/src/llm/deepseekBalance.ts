import logger from "../logger.js";
import { retry } from "../utils/index.js";
import { LlmHttpError } from "./errors.js";

/** Ответ DeepSeek GET /user/balance. */
interface DeepSeekBalanceResponse {
  is_available: boolean;
  balance_infos: Array<{
    currency: string;
    total_balance: string;
    granted_balance: string;
    topped_up_balance: string;
  }>;
}

export interface DeepSeekBalance {
  isAvailable: boolean;
  balanceInfos: Array<{
    currency: string;
    totalBalance: string;
    grantedBalance: string;
    toppedUpBalance: string;
  }>;
}

/**
 * Остаток баланса DeepSeek для данного ключа. Отдельный эндпоинт от listDeepSeekModels — тот же
 * паттерн ретрая (не ретраим 401 — сама неверность ключа не транзиентна).
 */
export async function getDeepSeekBalance(apiKey: string): Promise<DeepSeekBalance> {
  const t0 = Date.now();
  const data = await retry<DeepSeekBalanceResponse>(
    async () => {
      const response = await fetch("https://api.deepseek.com/user/balance", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new LlmHttpError("deepseek", response.status, text);
      }
      return (await response.json()) as DeepSeekBalanceResponse;
    },
    3,
    1500,
    "deepseek.getBalance",
    (err) => (err instanceof LlmHttpError ? err.status >= 500 || err.status === 429 : true),
  );

  logger.info(
    { durationMs: Date.now() - t0, isAvailable: data.is_available },
    "DeepSeek balance fetched",
  );
  return {
    isAvailable: data.is_available,
    balanceInfos: data.balance_infos.map((b) => ({
      currency: b.currency,
      totalBalance: b.total_balance,
      grantedBalance: b.granted_balance,
      toppedUpBalance: b.topped_up_balance,
    })),
  };
}
