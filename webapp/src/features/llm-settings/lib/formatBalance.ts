import type { DeepSeekBalance, DeepSeekBalanceInfo } from "../types/llmSettings";

// balanceInfos содержит записи сразу по нескольким валютам (CNY и USD), порядок в ответе API
// не гарантирован. Реальный баланс аккаунта — в одной из валют, остальные нулевые, поэтому
// берём запись с наибольшим totalBalance, а не первую по порядку.
function pickBalanceInfo(balance: DeepSeekBalance | null): DeepSeekBalanceInfo | undefined {
  return balance?.balanceInfos.reduce<DeepSeekBalanceInfo | undefined>(
    (best, info) =>
      !best || parseFloat(info.totalBalance) > parseFloat(best.totalBalance) ? info : best,
    undefined,
  );
}

export function formatBalanceSubtitle(balance: DeepSeekBalance | null, loading: boolean): string {
  if (loading) return "Загрузка…";
  const info = pickBalanceInfo(balance);
  if (!info) return "Не удалось загрузить";
  return `${info.totalBalance} ${info.currency}`;
}

export function formatBalanceDescription(balance: DeepSeekBalance | null): string | undefined {
  const info = pickBalanceInfo(balance);
  if (!info) return undefined;
  const parts = [`пополнено ${info.toppedUpBalance}`, `бонус ${info.grantedBalance}`];
  if (!balance.isAvailable) parts.push("баланс исчерпан");
  return parts.join(" · ");
}
