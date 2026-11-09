/**
 * Команда для PowerShell на ПК с ComfyUI. TLS 1.2 включаем заранее: PowerShell 5.1 может не
 * предложить его сам, и скачивание установщика не начнётся. Адрес — текущий сайт приложения,
 * поэтому команда из локальной разработки ставит агента на локальный сервер.
 */
export function buildInstallCommand(origin: string, code: string): string {
  const url = `${origin.replace(/\/$/, "")}/api/comfy-agent/agent/install?c=${encodeURIComponent(code)}`;
  return `[Net.ServicePointManager]::SecurityProtocol='Tls12'; irm '${url}' | iex`;
}

/** 17066033152 → «15,9 ГБ» (двоичные гигабайты — как их показывает Windows). */
export function formatGigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ГБ`;
}
