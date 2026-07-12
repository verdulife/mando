@echo off
setlocal
chcp 65001 >nul 2>&1

:: ─── Detectar PowerShell 7+ ───
where pwsh.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  Necesitas PowerShell 7 para ejecutar este instalador.
  echo.
  echo  Instalalo con: winget install Microsoft.PowerShell
  echo.
  pause
  exit /b 1
)

:: ─── Extraer script PowerShell de este archivo y ejecutarlo ───
set "BATFILE=%~f0"
set "M1=___POWERSHELL"
set "MARKER=%M1%___"
pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:BATFILE); $i=$c.IndexOf($env:MARKER); $s=$c.Substring($i+$env:MARKER.Length); $t=[IO.Path]::Combine($env:TEMP,'mando-install.ps1'); [IO.File]::WriteAllText($t,$s); & $t"
exit /b %ERRORLEVEL%

___POWERSHELL___
#!/usr/bin/env pwsh
#Requires -Version 7.0

# ══════════════════════════════════════════════════════════════════
# Mando — Instalador interactivo
# ══════════════════════════════════════════════════════════════════

$BoxWidth = 66
$InternalWidth = $BoxWidth - 4

# ─── Paleta de colores ───
$C = @{
  Brand   = $PSStyle.Foreground.FromRgb(237, 202, 72)
  BrandBg = $PSStyle.Background.FromRgb(237, 202, 72)
  Text    = $PSStyle.Foreground.FromRgb(229, 229, 229)
  Muted   = $PSStyle.Foreground.FromRgb(136, 136, 136)
  Success = $PSStyle.Foreground.FromRgb(34, 197, 94)
  Danger  = $PSStyle.Foreground.FromRgb(220, 38, 38)
  White   = $PSStyle.Foreground.White
  Black   = $PSStyle.Foreground.Black
  Reset   = $PSStyle.Reset
}

# ─── Utilidades de renderizado ───

function Remove-ANSI($t) { $t -replace "\e\[[0-9;]*m", "" }

function Centered($t) {
  $visible = (Remove-ANSI $t).Length
  $pad = [Math]::Max(0, [Math]::Floor(($InternalWidth - $visible) / 2))
  return (' ' * $pad) + $t + (' ' * ($InternalWidth - $visible - $pad))
}

function BoxLine($content) {
  $clean = Remove-ANSI $content
  $pad = ' ' * [Math]::Max(0, $InternalWidth - $clean.Length)
  Write-Host "$($C.Brand)║$ResetAll  $content$pad$($C.Brand)║$ResetAll"
}

function BoxEmpty { BoxLine "" }

function Logo {
  $logo = @(
    "  ███╗   ███╗ █████╗ ███╗   ██╗██████╗  ██████╗ "
    "  ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝ "
    "  ██╔████╔██║███████║██╔██╗ ██║██║  ██║██║  ███╗"
    "  ██║╚██╔╝██║██╔══██║██║╚██╗██║██║  ██║██║   ██║"
    "  ██║ ╚═╝ ██║██║  ██║██║ ╚████║██████╔╝╚██████╔╝"
    "  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝  ╚═════╝ "
  )
  foreach ($line in $logo) { BoxLine "$($C.Brand)$line$ResetAll" }
  BoxEmpty
  BoxLine "$($C.White)🎮 Instalador de Mando  v0.1.0$ResetAll"
}

function TopBorder  { Write-Host "$($C.Brand)╔$( '═' * ($BoxWidth - 2) )╗$ResetAll" }
function Separator  { Write-Host "$($C.Brand)╠$( '═' * ($BoxWidth - 2) )╣$ResetAll" }
function BottomBorder { Write-Host "$($C.Brand)╚$( '═' * ($BoxWidth - 2) )╝$ResetAll" }

function Clear-Screen { Write-Host "`e[2J`e[H" -NoNewLine }

# ─── Select-Option — menú horizontal ← → ───

function Select-Option {
  param([string[]]$Options, $Message = "", [int]$DefaultIndex = 0)

  $selected = $DefaultIndex

  if ($Message) {
    foreach ($line in ($Message -split "`n")) { BoxLine "  $($C.Text)$line$ResetAll" }
    BoxEmpty
  }

  function Draw-Options($sel, [switch]$Redraw) {
    $render = "  "
    for ($i = 0; $i -lt $Options.Length; $i++) {
      $opt = $Options[$i]
      if ($i -eq $sel) {
        $render += "$($C.BrandBg)$($C.Black)  $opt  $ResetAll  "
      } else {
        $render += "$($C.Muted)$opt$ResetAll  "
      }
    }
    $render = Centered ($render.TrimEnd())

    if ($Redraw) {
      try { [Console]::CursorTop = $global:optRow; [Console]::CursorLeft = 0 } catch {}
      Write-Host "$($C.Brand)║$ResetAll  $render$( ' ' * ($InternalWidth - (Remove-ANSI $render).Length) )$($C.Brand)║$ResetAll"
      try { [Console]::CursorTop = $global:hintRow; [Console]::CursorLeft = 0 } catch {}
      Write-Host "$($C.Brand)║$ResetAll  $($C.Muted)← → cambiar opción · Enter aceptar$ResetAll$( ' ' * ($InternalWidth - 36) )$($C.Brand)║$ResetAll"
      try { [Console]::CursorTop = $global:optRow; [Console]::CursorLeft = 0 } catch {}
    } else {
      BoxLine $render
      try { $global:optRow = [Console]::CursorTop } catch { $global:optRow = 0 }
      BoxEmpty
      BoxLine "$($C.Muted)← → cambiar opción · Enter aceptar$ResetAll"
      try { $global:hintRow = [Console]::CursorTop } catch { $global:hintRow = 0 }
    }
  }

  Draw-Options $selected

  while ($true) {
    $key = $Host.UI.RawUI.ReadKey('IncludeKeyDown')
    if ($key.Key -eq 'LeftArrow' -and $selected -gt 0) { $selected--; Draw-Options $selected -Redraw }
    elseif ($key.Key -eq 'RightArrow' -and $selected -lt $Options.Length - 1) { $selected++; Draw-Options $selected -Redraw }
    elseif ($key.Key -eq 'Enter') { break }
  }

  return $selected
}

# ─── Confirm-Action ───

function Confirm-Action($body) {
  Clear-Screen
  TopBorder
  Logo
  Separator
  foreach ($line in ($body -split "`n")) { BoxLine "  $($C.Text)$line$ResetAll" }
  BoxEmpty
  $result = Select-Option -Options @('Continuar', 'Cancelar') -DefaultIndex 0
  BottomBorder
  return $result -eq 0
}

# ─── Step rendering ───

function Step($text) {
  Write-Host "  $($C.Muted)[→]$ResetAll  $text" -NoNewLine
}

function Step-Done {
  Write-Host "`e[D`e[K  $($C.Success)[✓]$ResetAll  " -NoNewLine
}
function Step-Fail {
  Write-Host "`e[D`e[K  $($C.Danger)[✗]$ResetAll  " -NoNewLine
}
function Step-NextLine { Write-Host "" }

# ─── Welcome ───

function Show-Welcome {
  $body = @"
Bienvenido al instalador de Mando.

Este asistente instalará en tu sistema:
  • Bun — El runtime de JavaScript/TypeScript
    necesario para ejecutar el servidor
  • ViGEmBus — El driver que permite crear
    mandos virtuales Xbox 360 en Windows
  • Mando — La aplicación principal

Todo el proceso es guiado y te avisaremos
antes de cada paso.

¿Preparado para empezar?
"@
  return Confirm-Action $body
}

# ─── Step: Bun ───

function Install-Bun {
  $body = @"
A continuación se instalará Bun.

Bun es el runtime de JavaScript/TypeScript
que ejecutará el servidor de Mando.

Se descargará automáticamente desde bun.sh
e instalará en tu sistema.
"@
  if (-not (Confirm-Action $body)) { return $false }

  try {
    $ver = bun --version 2>$null
    Step "Bun ya está instalado ($ver)"
    Step-Done; Step-NextLine
    return $true
  } catch {}

  Step "Descargando e instalando Bun..."
  try {
    $env:BUN_INSTALL = "$env:LOCALAPPDATA\bun"
    $url = "https://bun.sh/install"
    $script = Invoke-WebRequest -Uri $url -UseBasicParsing | Select-Object -ExpandProperty Content
    $tempScript = [System.IO.Path]::GetTempFileName() + ".ps1"
    Set-Content -Path $tempScript -Value $script -Encoding UTF8
    $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$tempScript`"" -Wait -PassThru -WindowStyle Hidden
    Remove-Item -Force $tempScript -ErrorAction SilentlyContinue
    if ($proc.ExitCode -ne 0) { throw "Exit code $($proc.ExitCode)" }
    $env:Path = "$env:BUN_INSTALL\bin;$env:Path"
    [Environment]::SetEnvironmentVariable('Path', "$env:BUN_INSTALL\bin;$([Environment]::GetEnvironmentVariable('Path', 'User'))", 'User')
    $ver = bun --version 2>$null
    Step-Done
    Write-Host "Bun $ver instalado" -NoNewLine
    Step-NextLine
    return $true
  } catch {
    Step-Fail
    Write-Host "Error: $_" -NoNewLine
    Step-NextLine
    return $false
  }
}

# ─── Step: ViGEmBus ───

function Install-ViGEmBus {
  $body = @"
A continuación se instalará ViGEmBus.

ViGEmBus es el driver que permite a Windows
crear mandos virtuales Xbox 360.

Se abrirá un instalador. Por favor, sigue
los pasos que aparecerán en pantalla.
Se requiere permisos de administrador.
"@
  if (-not (Confirm-Action $body)) { return $false }

  if (Test-Path "$env:SystemRoot\System32\drivers\ViGEmBus.sys") {
    Step "ViGEmBus ya está instalado"
    Step-Done; Step-NextLine
    return $true
  }

  if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]'Administrator')) {
    BoxLine "  $($C.Brand)⚠$ResetAll  $($C.Text)Se requieren permisos de administrador.$ResetAll"
    BoxLine "  $($C.Muted)Reiniciando instalador como administrador...$ResetAll"
    Start-Process -FilePath 'pwsh.exe' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
  }

  Step "Descargando ViGEmBus..."
  try {
    $url = "https://github.com/ViGEm/ViGEmBus/releases/download/v1.22.0/ViGEmBus_1.22.0_x64_x86_arm64.exe"
    $outPath = "$env:TEMP\ViGEmBus_installer.exe"
    Invoke-WebRequest -Uri $url -OutFile $outPath -UseBasicParsing
    Step-Done; Step-NextLine
    Step "Ejecutando instalador (sigue los pasos)..."
    $proc = Start-Process -FilePath $outPath -ArgumentList '/exenoui /qn /norestart' -Wait -PassThru -NoNewWindow
    if ($proc.ExitCode -eq 0 -or $proc.ExitCode -eq 1641 -or $proc.ExitCode -eq 3010) {
      Step-Done; Step-NextLine
      if ($proc.ExitCode -eq 3010 -or $proc.ExitCode -eq 1641) {
        BoxEmpty
        $restart = Select-Option -Options @('Reiniciar ahora', 'Ahora no') -Message "Es necesario reiniciar para que el driver funcione."
        if ($restart -eq 0) {
          BoxLine "  $($C.Muted)Reiniciando en 5 segundos...$ResetAll"
          Start-Process -FilePath 'shutdown.exe' -ArgumentList '/r /t 5'
          exit
        }
      }
      return $true
    } else {
      Step-Fail; Write-Host "Código: $($proc.ExitCode)" -NoNewLine; Step-NextLine
      return $false
    }
  } catch {
    Step-Fail; Write-Host "$_" -NoNewLine; Step-NextLine
    return $false
  }
}

# ─── Step: Download Mando ───

function Install-Mando {
  $body = @"
A continuación se descargará Mando.

La aplicación se instalará en:
  %APPDATA%\Mando

Se descargarán los archivos necesarios
y se instalarán las dependencias.
"@
  if (-not (Confirm-Action $body)) { return $false }

  $dest = "$env:APPDATA\Mando"
  $scriptDir = Split-Path -Parent $PSCommandPath
  $projectDir = Split-Path -Parent $scriptDir

  if (Test-Path "$dest\src\server.ts") {
    Step "Mando ya está descargado en $dest"
    Step-Done; Step-NextLine
    Step "Actualizando dependencias..."
    try {
      Push-Location $dest
      $proc = Start-Process -FilePath 'bun' -ArgumentList 'install' -Wait -PassThru -NoNewWindow
      Pop-Location
      if ($proc.ExitCode -ne 0) { throw "bun install falló" }
      Step-Done; Step-NextLine
      return $true
    } catch {
      Step-Fail; Write-Host "$_" -NoNewLine; Step-NextLine
      return $false
    }
  }

  Step "Descargando Mando..."
  try {
    # Try local copy first
    if (Test-Path "$projectDir\src\server.ts") {
      if (Test-Path $dest) { Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue }
      Copy-Item -Recurse -Path "$projectDir\*" -Destination $dest -Exclude @('node_modules', '.git', 'dist')
      Step-Done
      Write-Host "Copiado desde origen local" -NoNewLine
    } else {
      $url = "https://github.com/anomalyco/mando/archive/refs/heads/main.zip"
      $zipPath = "$env:TEMP\mando.zip"
      Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
      Step-Done; Step-NextLine
      Step "Extrayendo archivos..."
      if (Test-Path $dest) { Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue }
      $extractDir = "$env:TEMP\mando-extract"
      if (Test-Path $extractDir) { Remove-Item -Recurse -Force $extractDir -ErrorAction SilentlyContinue }
      Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
      Move-Item -Path "$extractDir\mando-main\*" -Destination $dest
      Remove-Item -Recurse -Force $extractDir -ErrorAction SilentlyContinue
      Step-Done
      Write-Host "Extraído en $dest" -NoNewLine
    }
    Step-NextLine

    Step "Instalando dependencias (bun install)..."
    Push-Location $dest
    $proc = Start-Process -FilePath 'bun' -ArgumentList 'install' -Wait -PassThru -NoNewWindow
    Pop-Location
    if ($proc.ExitCode -ne 0) { throw "bun install falló (código $($proc.ExitCode))" }
    Step-Done; Step-NextLine
    return $true
  } catch {
    Step-Fail; Write-Host "$_" -NoNewLine; Step-NextLine
    return $false
  }
}

# ─── Setup AutoStart ───

function Setup-AutoStart {
  $body = @"
¿Quieres que Mando arranque automáticamente
al iniciar sesión en Windows?

Se creará una tarea programada que ejecutará
Mando en segundo plano sin ventana visible.

Podrás desactivarlo más tarde desde el
panel de administración.
"@
  if (-not (Confirm-Action $body)) {
    BoxLine "  $($C.Muted)[—]$ResetAll  Inicio automático omitido"
    return $false
  }

  Step "Creando tarea programada..."
  try {
    $dest = "$env:APPDATA\Mando"
    $launcherContent = @'
$mandoDir = "$env:APPDATA\Mando"
Set-Location $mandoDir
$env:Path = "$env:LOCALAPPDATA\bun\bin;$env:Path"
Start-Process -WindowStyle Hidden -NoNewWindow -FilePath 'bun' -ArgumentList 'run', "src/server.ts"
'@
    $launcherPath = "$dest\scripts\run.ps1"
    $null = New-Item -ItemType Directory -Path ([System.IO.Path]::GetDirectoryName($launcherPath)) -Force
    Set-Content -Path $launcherPath -Value $launcherContent -Encoding UTF8

    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherPath`"" -WorkingDirectory $dest
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Limited -LogonType S4U
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

    Register-ScheduledTask -TaskName 'Mando' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Step-Done
    Write-Host "Tarea 'Mando' creada" -NoNewLine
    Step-NextLine
    return $true
  } catch {
    Step-Fail
    Write-Host "$_" -NoNewLine
    Step-NextLine
    return $false
  }
}

# ─── Summary ───

function Show-Summary($steps) {
  Clear-Screen
  TopBorder
  Logo
  Separator

  BoxLine "  $($C.White)Resumen de instalación$ResetAll"
  BoxEmpty

  $allOk = $true
  foreach ($s in $steps) {
    if ($s.ok) {
      BoxLine "  $($C.Success)[✓]$ResetAll  $($C.Text)$($s.name)$ResetAll"
    } else {
      BoxLine "  $($C.Muted)[—]$ResetAll  $($C.Muted)$($s.name)$ResetAll"
      if ($s.ok -eq $false) { $allOk = $false }
    }
  }

  BoxEmpty
  if ($allOk) {
    BoxLine "  $($C.Success)¡Instalación completada!$ResetAll"
  } else {
    BoxLine "  $($C.Brand)⚠$ResetAll  $($C.Text)Algunos pasos se omitieron o fallaron.$ResetAll"
    BoxLine "  $($C.Muted)Puedes volver a ejecutar el instalador cuando quieras.$ResetAll"
  }

  BoxEmpty
  BoxLine "  $($C.Muted)Panel de administración:$ResetAll  $($C.Brand)http://localhost:7355/admin$ResetAll"
  BoxEmpty

  $openBrowser = Select-Option -Options @('Abrir admin', 'Cerrar') -DefaultIndex 0
  if ($openBrowser -eq 0) { Start-Process "http://localhost:7355/admin" }
  BottomBorder
}

# ══════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try { [Console]::CursorVisible = $false } catch {}

# Pre: PowerShell 7+
if ($PSVersionTable.PSVersion.Major -lt 7) {
  Write-Host "$($C.Danger)Mando necesita PowerShell 7 o superior.$ResetAll"
  Write-Host "$($C.Text)Instálalo con: winget install Microsoft.PowerShell$ResetAll"
  Start-Process 'winget.exe' -ArgumentList 'install Microsoft.PowerShell'
  exit 1
}

# Pre: 64-bit
if (-not [Environment]::Is64BitOperatingSystem) {
  Write-Host "$($C.Danger)Mando solo funciona en Windows 64 bits.$ResetAll"
  pause; exit 1
}

# Pre: Windows 10+
if ([Environment]::OSVersion.Version.Major -lt 10) {
  Write-Host "$($C.Danger)Mando requiere Windows 10 o superior.$ResetAll"
  pause; exit 1
}

$stepResults = @()

# — Bienvenida —
if (-not (Show-Welcome)) {
  Clear-Screen
  Write-Host "$($C.Muted)Instalación cancelada.$ResetAll"
  try { [Console]::CursorVisible = $true } catch {}
  exit 0
}

# — Bun —
Clear-Screen; TopBorder; Logo; Separator
$stepResults += @{ name = 'Bun'; ok = Install-Bun }

# — ViGEmBus —
Clear-Screen; TopBorder; Logo; Separator
$stepResults += @{ name = 'ViGEmBus'; ok = Install-ViGEmBus }

# — Mando —
Clear-Screen; TopBorder; Logo; Separator
$stepResults += @{ name = 'Mando'; ok = Install-Mando }

# — AutoStart —
Clear-Screen; TopBorder; Logo; Separator
$stepResults += @{ name = 'Inicio automático'; ok = Setup-AutoStart }

# — Resumen —
Show-Summary $stepResults

try { [Console]::CursorVisible = $true } catch {}
