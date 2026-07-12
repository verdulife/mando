import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'

// Embed ViGEmBus installer in the compiled exe
import installerAsset from '../assets/ViGEmBus_1.22.0_x64_x86_arm64.exe.bin' with { type: 'file' }

// Prevent tree-shaking
const _keepInstaller = installerAsset
void _keepInstaller

const VIGEM_SYS_PATH = 'C:\\Windows\\System32\\drivers\\ViGEmBus.sys'
const SERVICE_NAME = 'ViGEmBus'

export type InstallResult =
  | { status: 'already_installed' }
  | { status: 'installed_and_loaded' }
  | { status: 'need_reboot' }
  | { status: 'no_installer' }
  | { status: 'error'; message: string }

const DEBUG = process.env.MANDO_DEBUG === '1'
function log(...args: any[]) {
  if (!DEBUG) return
  console.error('[vigem-installer]', ...args)
}

export function isViGEmBusInstalled(): boolean {
  return existsSync(VIGEM_SYS_PATH)
}

function isAdmin(): boolean {
  try {
    const result = Bun.spawnSync([
      'powershell.exe', '-NoProfile', '-Command',
      '[Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent() | ForEach-Object { $_.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }'
    ], { windowsHide: true })
    return result.stdout.toString().trim() === 'True'
  } catch {
    return false
  }
}

function tryReLaunchAsAdmin(): boolean {
  try {
    log('Re-lanzando como administrador...')
    const cmd = `Start-Process -FilePath '${process.execPath}' -Verb RunAs`
    Bun.spawnSync(['powershell.exe', '-NoProfile', '-Command', cmd], { windowsHide: true })
    return true
  } catch {
    return false
  }
}

function startDriverService(): boolean {
  try {
    log('Intentando iniciar servicio ViGEmBus...')
    const result = Bun.spawnSync(['sc', 'start', SERVICE_NAME], { windowsHide: true })
    const ok = result.exitCode === 0
    log('sc start result:', ok ? 'OK' : 'FAIL', result.stdout.toString().trim())
    return ok
  } catch (e) {
    log('Error starting driver:', e)
    return false
  }
}

async function extractInstaller(): Promise<string | null> {
  const dest = path.join(os.tmpdir(), 'mando-vigembus-installer.exe')
  if (existsSync(dest)) {
    log('Installer already extracted:', dest)
    return dest
  }

  // Try reading from the embedded virtual file path first.
  // In compiled exe: installerAsset is a virtual path inside the binary.
  // In dev mode: installerAsset is the real file path on disk.
  const srcPath = typeof installerAsset === 'string' ? installerAsset : null
  if (srcPath) {
    try {
      const buf = await Bun.file(srcPath).arrayBuffer()
      mkdirSync(path.dirname(dest), { recursive: true })
      writeFileSync(dest, new Uint8Array(buf))
      log('Installer extracted from:', srcPath)
      return dest
    } catch {
      log('Failed to read installer from:', srcPath)
    }
  }

  // Dev fallback: try relative to project root
  const altPath = path.resolve(import.meta.dir ?? '', '..', 'assets', 'ViGEmBus_1.22.0_x64_x86_arm64.exe.bin')
  if (existsSync(altPath)) {
    log('Using alt installer at:', altPath)
    const buf = await Bun.file(altPath).arrayBuffer()
    mkdirSync(path.dirname(dest), { recursive: true })
    writeFileSync(dest, new Uint8Array(buf))
    return dest
  }

  log('No installer found anywhere')
  return null
}

export async function installViGEmBus(): Promise<InstallResult> {
  if (isViGEmBusInstalled()) {
    log('ViGEmBus ya está instalado')
    return { status: 'already_installed' }
  }

  const installerPath = await extractInstaller()
  if (!installerPath) {
    return { status: 'no_installer' }
  }

  // Check admin
  if (!isAdmin()) {
    log('No somos administrador, intentando re-lanzar...')
    const launched = tryReLaunchAsAdmin()
    if (launched) {
      // Exit current process, admin instance will take over
      process.exit(0)
    }
    return {
      status: 'error',
      message: 'Se requieren permisos de administrador para instalar ViGEmBus. Ejecuta mando.exe como administrador.'
    }
  }

  log('Ejecutando instalador silencioso...')
  try {
    const result = Bun.spawnSync([
      installerPath, '/exenoui', '/qn', '/norestart'
    ], { windowsHide: true })

    log('Installer exit code:', result.exitCode)

    // 0 = success, 1641 = success + reboot initiated, 3010 = success + reboot required
    if (result.exitCode === 0 || result.exitCode === 1641 || result.exitCode === 3010) {
      log('Instalación completada. Intentando cargar driver...')
      const loaded = startDriverService()
      if (loaded) {
        return { status: 'installed_and_loaded' }
      }
      return { status: 'need_reboot' }
    }

    return {
      status: 'error',
      message: `Instalador falló con código: ${result.exitCode}`
    }
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : String(e)
    }
  }
}
