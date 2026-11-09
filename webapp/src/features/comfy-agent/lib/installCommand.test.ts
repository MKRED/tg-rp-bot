import { describe, expect, it } from "vitest";
import { buildInstallCommand, formatGigabytes } from "./installCommand";

describe("buildInstallCommand", () => {
  it("собирает команду с кодом и адресом приложения", () => {
    expect(buildInstallCommand("https://miniapp.aoshi.ru/", "Ab-_9")).toBe(
      "[Net.ServicePointManager]::SecurityProtocol='Tls12'; irm 'https://miniapp.aoshi.ru/api/comfy-agent/agent/install?c=Ab-_9' | iex",
    );
  });
});

describe("formatGigabytes", () => {
  it("округляет до десятых, с запятой", () => {
    expect(formatGigabytes(17066033152).replace(/\s/g, " ")).toBe("15,9 ГБ");
    expect(formatGigabytes(16 * 1024 ** 3).replace(/\s/g, " ")).toBe("16 ГБ");
  });
});
