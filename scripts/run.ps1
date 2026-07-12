#!/usr/bin/env pwsh
#Requires -Version 7.0

# Mando — Launcher invisible para inicio automático
# Llamado desde Scheduled Task

$mandoDir = "$env:APPDATA\Mando"
$bunDir = "$env:LOCALAPPDATA\bun"

if (-not (Test-Path "$mandoDir\src\server.ts")) {
  Write-Error "Mando no encontrado en $mandoDir"
  exit 1
}

$env:Path = "$bunDir\bin;$env:Path"

Set-Location $mandoDir
Start-Process -WindowStyle Hidden -NoNewWindow -FilePath 'bun' -ArgumentList 'run', "src/server.ts"
