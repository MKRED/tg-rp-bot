import { describe, expect, it } from "vitest";
import { agentScript, installerScript, renderInstaller } from "./agent-scripts.js";

describe("agent-scripts", () => {
  it("подставляет сервер и токен, экранируя одинарные кавычки", () => {
    expect(renderInstaller("$s = '__SERVER__'; $t = '__TOKEN__'", "https://x.ru", "cagt_a'b")).toBe(
      "$s = 'https://x.ru'; $t = 'cagt_a''b'",
    );
  });

  it("файлы из bot/assets читаются, BOM снят, метки в установщике заменены", () => {
    expect(agentScript().charCodeAt(0)).not.toBe(0xfeff);
    expect(agentScript()).toContain("/api/comfy-agent/agent/poll");
    const installer = installerScript("https://srv", "cagt_tok");
    expect(installer).toContain("$server = 'https://srv'");
    expect(installer).toContain("$token = 'cagt_tok'");
    expect(installer).not.toContain("__TOKEN__");
  });
});
