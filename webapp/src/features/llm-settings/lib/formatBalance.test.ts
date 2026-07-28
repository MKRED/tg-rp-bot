import { describe, expect, it } from "vitest";
import type { DeepSeekBalance } from "../types/llmSettings";
import { formatBalanceDescription, formatBalanceSubtitle } from "./formatBalance";

const balance: DeepSeekBalance = {
  isAvailable: true,
  balanceInfos: [
    { currency: "CNY", totalBalance: "110.00", grantedBalance: "10.00", toppedUpBalance: "100.00" },
  ],
};

describe("formatBalanceSubtitle", () => {
  it("shows loading state first", () => {
    expect(formatBalanceSubtitle(balance, true)).toBe("Загрузка…");
  });

  it("shows fallback when there is no data", () => {
    expect(formatBalanceSubtitle(null, false)).toBe("Не удалось загрузить");
  });

  it("shows total and currency", () => {
    expect(formatBalanceSubtitle(balance, false)).toBe("110.00 CNY");
  });
});

describe("formatBalanceDescription", () => {
  it("returns undefined when there is no data", () => {
    expect(formatBalanceDescription(null)).toBeUndefined();
  });

  it("shows top-up and bonus breakdown", () => {
    expect(formatBalanceDescription(balance)).toBe("пополнено 100.00 · бонус 10.00");
  });

  it("flags an exhausted balance", () => {
    expect(formatBalanceDescription({ ...balance, isAvailable: false })).toBe(
      "пополнено 100.00 · бонус 10.00 · баланс исчерпан",
    );
  });
});
