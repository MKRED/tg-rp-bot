import type { DeepSeekBalance } from "../types/llmSettings";

// balanceInfos обычно содержит одну запись (валюта аккаунта DeepSeek) — на несколько записей API
// не рассчитываем, берём первую.
export function formatBalanceSubtitle(balance: DeepSeekBalance | null, loading: boolean): string {
  if (loading) return "Загрузка…";
  const info = balance?.balanceInfos[0];
  if (!info) return "Не удалось загрузить";
  return `${info.totalBalance} ${info.currency}`;
}

export function formatBalanceDescription(balance: DeepSeekBalance | null): string | undefined {
  const info = balance?.balanceInfos[0];
  if (!info) return undefined;
  const parts = [`пополнено ${info.toppedUpBalance}`, `бонус ${info.grantedBalance}`];
  if (!balance.isAvailable) parts.push("баланс исчерпан");
  return parts.join(" · ");
}
