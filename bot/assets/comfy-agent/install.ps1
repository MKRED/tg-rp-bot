# Установщик агента ComfyUI для tg-rp-bot. Сервер отдаёт его по одноразовому коду и подставляет
# адрес сервера и свежий токен вместо меток ниже. Запускается через `irm ... | iex`, поэтому без
# param() и без exit: exit закрыл бы окно PowerShell пользователя. Всё внутри & { } — переменные
# и $ErrorActionPreference не остаются в сессии пользователя.
& {
  $ErrorActionPreference = "Stop"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $server = '__SERVER__'
  $token = '__TOKEN__'
  try {
    $dir = Join-Path $env:LOCALAPPDATA "tg-rp-bot-agent"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $agentPath = Join-Path $dir "comfy-agent.ps1"

    $agent = Invoke-RestMethod -Uri "$server/api/comfy-agent/agent/script" -TimeoutSec 60
    # BOM обязателен: без него PowerShell 5.1 прочитает русский текст агента как ANSI.
    [IO.File]::WriteAllText($agentPath, $agent, (New-Object System.Text.UTF8Encoding $true))
    $config = @{ server = $server; token = $token } | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $dir "config.json"), $config, (New-Object System.Text.UTF8Encoding $false))

    $arguments = "-NoExit -ExecutionPolicy Bypass -File `"$agentPath`""
    $desktop = [Environment]::GetFolderPath("Desktop")
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop "Агент ComfyUI (tg-rp-bot).lnk"))
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = $arguments
    $shortcut.WorkingDirectory = $dir
    $shortcut.Save()

    Start-Process powershell.exe -ArgumentList $arguments
    Write-Host ""
    Write-Host "Агент установлен и запущен в отдельном окне." -ForegroundColor Green
    Write-Host "Дальше запускайте его ярлыком «Агент ComfyUI (tg-rp-bot)» на рабочем столе."
    Write-Host "Файлы агента: $dir"
  } catch {
    Write-Host ""
    Write-Host "Не удалось установить агента: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Получите новую команду в приложении и попробуйте ещё раз."
  }
}
