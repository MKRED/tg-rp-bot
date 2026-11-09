import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Скрипты лежат в bot/assets/comfy-agent: путь одинаков из src/ (vitest, dev) и из dist/ (прод) —
// оба на той же глубине под bot/. В Docker-образ папку копирует Dockerfile.
const ASSETS_DIR = new URL("../../../assets/comfy-agent/", import.meta.url);

let cache: { agent: string; installer: string } | null = null;

function load(): { agent: string; installer: string } {
  cache ??= {
    agent: readAsset("comfy-agent.ps1"),
    installer: readAsset("install.ps1"),
  };
  return cache;
}

/** Без BOM: установщик пишет файл на диск сам, уже с BOM, а `iex` с BOM в начале строки не дружит. */
function readAsset(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, ASSETS_DIR)), "utf8").replace(/^﻿/, "");
}

/** Текст агента для скачивания установщиком. */
export function agentScript(): string {
  return load().agent;
}

/** Установщик с подставленными адресом сервера и токеном. */
export function installerScript(server: string, token: string): string {
  return renderInstaller(load().installer, server, token);
}

/** Подстановка в строки PowerShell в одинарных кавычках: там экранируется только сама кавычка. */
export function renderInstaller(template: string, server: string, token: string): string {
  const quote = (value: string) => value.replace(/'/g, "''");
  return template.replace("__SERVER__", quote(server)).replace("__TOKEN__", quote(token));
}
