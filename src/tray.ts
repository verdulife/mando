const SysTrayModule = require('systray2')
const SysTray = SysTrayModule.default || SysTrayModule
import os from 'os'
import path from 'path'
import { exec, execSync } from 'child_process'
import fs from 'fs'
import { getPublicIconPath } from './public-loader'

const APP_NAME = 'Mando'
const CONFIG_DIR = path.join(os.homedir(), 'AppData', 'Roaming', APP_NAME)
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
const REGISTRY_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'

interface Config {
  autoStart: boolean
  defaultLayout: string
}

function getExePath(): string {
  return process.execPath
}

export function isAutoStartEnabled(): boolean {
  try {
    const output = execSync(`reg query "${REGISTRY_KEY}" /v "${APP_NAME}" 2>nul`, { encoding: 'utf-8' })
    return output.includes(APP_NAME)
  } catch {
    return false
  }
}

export function setAutoStart(enabled: boolean): void {
  const exePath = getExePath()
  const currentlyEnabled = isAutoStartEnabled()

  if (enabled && !currentlyEnabled) {
    try {
      execSync(`reg add "${REGISTRY_KEY}" /v "${APP_NAME}" /t REG_SZ /d "\\"${exePath}\\" --autostart" /f`)
    } catch (error) {
      console.error(`[Mando] No se pudo activar el inicio automático: ${error}`)
    }
  } else if (!enabled && currentlyEnabled) {
    try {
      execSync(`reg delete "${REGISTRY_KEY}" /v "${APP_NAME}" /f`)
    } catch (error) {
      console.error(`[Mando] No se pudo desactivar el inicio automático: ${error}`)
    }
  }
}

export function loadConfig(): Config {
  const autoStart = isAutoStartEnabled()
  let defaultLayout = 'default'
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
      if (typeof data.defaultLayout === 'string') {
        defaultLayout = data.defaultLayout
      }
      if (typeof data.autoStart === 'boolean' && data.autoStart !== autoStart) {
        saveConfig({ autoStart, defaultLayout })
      }
    }
  } catch {
    // Ignorar errores de lectura/parseo
  }
  return { autoStart, defaultLayout }
}

export function saveConfig(config: Config): void {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  } catch (error) {
    console.error(`[Mando] No se pudo guardar la configuración: ${error}`)
  }
}

function openAdminPanel(adminUrl: string): void {
  exec(`start "" "${adminUrl}"`, { windowsHide: true })
}

export function initTray(adminUrl: string, onExit: () => void): any {
  const config = loadConfig()

  const iconPath = getPublicIconPath()

  const openItem: any = {
    title: 'Abrir panel de administración',
    tooltip: 'Abrir el panel web en el navegador',
    checked: false,
    enabled: true,
    click: () => openAdminPanel(adminUrl)
  }

  const autoStartItem: any = {
    title: 'Iniciar con Windows',
    tooltip: 'Iniciar Mando automáticamente al arrancar Windows',
    checked: config.autoStart,
    enabled: true,
    click: () => {
      const newValue = !autoStartItem.checked
      autoStartItem.checked = newValue
      config.autoStart = newValue
      saveConfig(config)
      setAutoStart(newValue)
      systray.sendAction({
        type: 'update-item',
        item: autoStartItem
      })
    }
  }

  const exitItem: any = {
    title: 'Salir',
    tooltip: 'Cerrar Mando',
    checked: false,
    enabled: true,
    click: () => {
      systray.kill(false)
      onExit()
    }
  }

  const systray = new SysTray({
    menu: {
      icon: iconPath,
      title: APP_NAME,
      tooltip: 'Mando: controla mandos Xbox 360 virtuales desde tu dispositivo',
      items: [openItem, SysTray.separator, autoStartItem, SysTray.separator, exitItem]
    },
    debug: false,
    copyDir: true
  })

  systray.onClick((action: any) => {
    if (action.item.click != null) {
      action.item.click()
    }
  })

  systray.ready().catch((err: any) => {
    console.error(`[Mando] Error al iniciar el tray icon: ${err.message}`)
  })

  return systray
}
