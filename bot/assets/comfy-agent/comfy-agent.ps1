<#
  Агент ComfyUI для tg-rp-bot.

  Держит исходящее соединение с сервером приложения (HTTPS long-poll), забирает запросы к ComfyUI и
  выполняет их на этом ПК. ComfyUI может слушать только 127.0.0.1: открывать порты, настраивать
  домен или сертификат не нужно.

  Ставится командой из приложения (Настройки → ComfyUI): установщик кладёт этот файл и config.json
  с адресом сервера и токеном в %LOCALAPPDATA%\tg-rp-bot-agent и создаёт ярлык на рабочем столе.
  Параметры (необязательные, перекрывают config.json):
    -Token   токен агента
    -Server  адрес приложения
    -Comfy   адрес ComfyUI на этом ПК (по умолчанию http://127.0.0.1:8188)

  Агент выполняет только запросы из белого списка ниже: сервер не может через него сделать
  с ПК что-то кроме этих вызовов ComfyUI. Файл сохраняется в UTF-8 с BOM: иначе PowerShell 5.1
  прочитает русский текст как ANSI.
#>
param(
  [string]$Token,
  [string]$Server,
  [string]$Comfy
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Агент ComfyUI (tg-rp-bot)"

$ConfigPath = Join-Path $PSScriptRoot "config.json"
if (Test-Path $ConfigPath) {
  $config = [IO.File]::ReadAllText($ConfigPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
  if (-not $Token) { $Token = $config.token }
  if (-not $Server) { $Server = $config.server }
  if (-not $Comfy) { $Comfy = $config.comfy }
}
if (-not $Server) { $Server = "https://miniapp.aoshi.ru" }
if (-not $Comfy) { $Comfy = "http://127.0.0.1:8188" }
if (-not $Token) {
  Write-Host "Нет токена агента. Установите агента командой из приложения: Настройки → ComfyUI."
  exit 1
}
# PowerShell 5.1 по умолчанию может не предложить TLS 1.2, и HTTPS к серверу не установится.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Server = $Server.TrimEnd("/")
$Comfy = $Comfy.TrimEnd("/")
# X-Requested-With — CSRF-заголовок, который сервер требует у изменяющих запросов без initData.
# Версия агента: сервер сравнивает её с нужной и просит переустановить устаревшего агента.
$AgentVersion = 2
$Headers = @{ Authorization = "Bearer $Token"; "X-Requested-With" = "tg-rp-bot"; "X-Agent-Version" = "$AgentVersion" }

# Тот же список, что bot/src/comfy-agent/comfy-paths.ts.
$Allowed = @(
  @{ Method = "GET"; Pattern = '^/api/system_stats$' },
  @{ Method = "GET"; Pattern = '^/api/object_info(/[A-Za-z0-9_.-]+)?$' },
  @{ Method = "GET"; Pattern = '^/api/queue$' },
  @{ Method = "GET"; Pattern = '^/api/history/[A-Za-z0-9-]+$' },
  @{ Method = "GET"; Pattern = '^/api/view$' },
  @{ Method = "POST"; Pattern = '^/api/prompt$' },
  @{ Method = "POST"; Pattern = '^/api/upload/image$' },
  @{ Method = "POST"; Pattern = '^/api/interrupt$' },
  @{ Method = "POST"; Pattern = '^/api/queue$' }
)

function Write-Log([string]$Message) {
  Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message)
}

function Test-Allowed([string]$Method, [string]$Path) {
  foreach ($rule in $Allowed) {
    if ($rule.Method -ceq $Method -and $Path -cmatch $rule.Pattern) { return $true }
  }
  return $false
}

function New-Failure([string]$Reason) {
  return @{ status = 0; contentType = $null; bodyBase64 = ""; error = $Reason }
}

# Выполняет запрос к ComfyUI и возвращает статус, тип и тело в base64 (JSON и картинки одинаково).
function Invoke-Comfy($Job) {
  $url = $Comfy + $Job.path
  if ($Job.query) {
    $pairs = @()
    foreach ($p in $Job.query.PSObject.Properties) {
      $pairs += [Uri]::EscapeDataString($p.Name) + "=" + [Uri]::EscapeDataString([string]$p.Value)
    }
    if ($pairs.Count -gt 0) { $url += "?" + ($pairs -join "&") }
  }

  $request = [System.Net.HttpWebRequest]::Create($url)
  $request.Method = $Job.method
  $request.Timeout = 60000
  # ComfyUI локальный: системный прокси (если он есть) не должен перехватывать эти запросы.
  $request.Proxy = $null
  try {
    if ($Job.method -eq "POST") {
      $bytes = if ($Job.bodyBase64) { [Convert]::FromBase64String($Job.bodyBase64) } else { [byte[]]@() }
      $request.ContentType = if ($Job.contentType) { $Job.contentType } else { "application/json" }
      $request.ContentLength = $bytes.Length
      $stream = $request.GetRequestStream()
      try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Close() }
    }
    $response = $request.GetResponse()
  } catch [System.Net.WebException] {
    # Ответ с кодом ошибки — тоже ответ ComfyUI; нет ответа — ComfyUI недоступен.
    if ($_.Exception.Response) { $response = $_.Exception.Response }
    else { return New-Failure $_.Exception.Message }
  }

  try {
    $buffer = New-Object System.IO.MemoryStream
    $response.GetResponseStream().CopyTo($buffer)
    return @{
      status = [int]$response.StatusCode
      contentType = $response.ContentType
      bodyBase64 = [Convert]::ToBase64String($buffer.ToArray())
    }
  } finally {
    $response.Close()
  }
}

function Send-Result([string]$JobId, $Result) {
  $json = $Result | ConvertTo-Json -Compress
  # Тело байтами в UTF-8: строку PowerShell 5.1 отправил бы в другой кодировке.
  $body = [Text.Encoding]::UTF8.GetBytes($json)
  Invoke-RestMethod -Method Post -Uri "$Server/api/comfy-agent/agent/result/$JobId" -Headers $Headers `
    -ContentType "application/json; charset=utf-8" -Body $body -TimeoutSec 60 | Out-Null
}

Write-Log "Агент запущен. Сервер: $Server, ComfyUI: $Comfy"
$check = Invoke-Comfy @{ method = "GET"; path = "/api/system_stats" }
if ($check.status -eq 200) { Write-Log "ComfyUI отвечает." }
else { Write-Log "ComfyUI сейчас не отвечает ($($check.error)). Агент всё равно подключится и будет ждать." }

$delay = 1
while ($true) {
  try {
    # Сервер держит запрос ~20 с и отвечает раньше, если появилось задание.
    $reply = Invoke-RestMethod -Method Get -Uri "$Server/api/comfy-agent/agent/poll" -Headers $Headers -TimeoutSec 60
    if ($delay -gt 1) { Write-Log "Связь с сервером восстановлена." }
    $delay = 1
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -eq 401) {
      Write-Log "Сервер не принял токен: агента отключили в приложении или поставили заново на другом ПК. Чтобы подключить этот ПК, получите новую команду установки в приложении (Настройки → ComfyUI)."
      exit 1
    }
    Write-Log "Нет связи с сервером ($($_.Exception.Message)). Повтор через $delay с."
    Start-Sleep -Seconds $delay
    $delay = [Math]::Min($delay * 2, 30)
    continue
  }

  foreach ($job in @($reply.jobs)) {
    # Пустой список из JSON PowerShell 5.1 превращает в $null, а @($null) — массив из одного $null.
    if ($null -eq $job) { continue }
    $started = Get-Date
    if (Test-Allowed $job.method $job.path) {
      $result = Invoke-Comfy $job
    } else {
      $result = New-Failure "blocked by agent allowlist"
      Write-Log "Отклонён запрос вне белого списка: $($job.method) $($job.path)"
    }
    $ms = [int]((Get-Date) - $started).TotalMilliseconds
    Write-Log "$($job.method) $($job.path) -> $($result.status) за $ms мс"
    try { Send-Result $job.id $result }
    catch { Write-Log "Не удалось отправить ответ серверу: $($_.Exception.Message)" }
  }
}
