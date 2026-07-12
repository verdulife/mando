#!/usr/bin/env pwsh
#Requires -Version 7.0

# ══════════════════════════════════════════════════════════════════
# Mando — Desinstalador
# ══════════════════════════════════════════════════════════════════

$BoxWidth = 66

$C = @{
  Brand   = $PSStyle.Foreground.FromRgb(237, 202, 72)
  Text    = $PSStyle.Foreground.FromRgb(229, 229, 229)
  Muted   = $PSStyle.Foreground.FromRgb(136, 136, 136)
  Danger  = $PSStyle.Foreground.FromRgb(220, 38, 38)
  Reset   = $PSStyle.Reset
}

$ResetAll = $C.Reset

function Write-Line($content) {
  $visible = ($content -replace '\e\[[0-9;]*m', '').Length
  Write-Host "$($C.Brand)║$ResetAll $content$ResetAll$(' ' * ($BoxWidth - 4 - $visible))$($C.Brand)║$ResetAll"
}

function Write-Border($char) {
  Write-Host "$($C.Brand)$char$('═' * ($BoxWidth - 2))$($C.Brand)$char$ResetAll"
}

# ─── MAIN ───

Write-Border '╔'
Write-Line "$($C.Danger)  Desinstalador de Mando$ResetAll"
Write-Line ""
Write-Line "$($C.Text)  Esto eliminará:$ResetAll"
Write-Line "$($C.Muted)  • La carpeta %APPDATA%\Mando$ResetAll"
Write-Line "$($C.Muted)  • La tarea programada de inicio automático$ResetAll"
Write-Line "$($C.Muted)  • La entrada de registro RUN (si existe)$ResetAll"
Write-Line ""
Write-Line "$($C.Muted)  NOTA: Bun y ViGEmBus no se desinstalarán.$ResetAll"
Write-Line "$($C.Muted)  Si quieres eliminar Bun, usa:%APPDATA%\..\Local\bun\uninstall$ResetAll"
Write-Line "$($C.Muted)  ViGEmBus se desinstala desde: Agregar o quitar programas$ResetAll"
Write-Border '╚'

$confirmation = Read-Host "`n¿Desinstalar Mando? (s/n)"
if ($confirmation -notin @('s', 'S', 'si', 'Si', 'SI', 'y', 'Y', 'yes')) {
  Write-Host "${C.Muted}Desinstalación cancelada.${ResetAll}"
  exit 0
}

Write-Host "`n${C.Muted}[→]${ResetAll} Eliminando tarea programada..."
try {
  Unregister-ScheduledTask -TaskName 'Mando' -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "${C.Muted}[✓]${ResetAll} Tarea eliminada"
} catch { Write-Host "${C.Muted}[—]${ResetAll} No se encontró tarea programada" }

Write-Host "${C.Muted}[→]${ResetAll} Eliminando entrada de registro..."
try {
  Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'Mando' -ErrorAction SilentlyContinue
  Write-Host "${C.Muted}[✓]${ResetAll} Entrada eliminada"
} catch { Write-Host "${C.Muted}[—]${ResetAll} No se encontró entrada" }

Write-Host "${C.Muted}[→]${ResetAll} Eliminando carpeta de Mando..."
$mandoDir = "$env:APPDATA\Mando"
if (Test-Path $mandoDir) {
  Remove-Item -Recurse -Force $mandoDir
  Write-Host "${C.Muted}[✓]${ResetAll} Carpeta eliminada"
} else {
  Write-Host "${C.Muted}[—]${ResetAll} No se encontró la carpeta"
}

Write-Host "`n${C.Brand}${ResetAll}${C.Text}Desinstalación completada.${ResetAll}"
pause
