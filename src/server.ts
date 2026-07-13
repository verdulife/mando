import { Bonjour } from 'bonjour-service'
import os from 'os'
import path from 'path'
import QRCode from 'qrcode'
import { exec } from 'child_process'
import { initTray, loadConfig, saveConfig, type Config } from './tray'
import { getPublicDir } from './public-loader'
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import {
  initGamepad,
  createController,
  releaseController,
  setButton,
  setAxis,
  isGamepadClientConnected,
  getActiveControllersCount,
  type ButtonName,
  type AxisName
} from './gamepad'
import { installViGEmBus, isViGEmBusInstalled } from './vigem-installer'

const PORT = parseInt(process.env.PORT || '7355', 10)
const HOSTNAME = 'mando'
const PUBLIC_DIR = getPublicDir()
const STATIC_EXTENSIONS = new Set([
  '.html', '.json', '.js', '.png', '.svg', '.ico', '.css',
  '.woff2', '.woff', '.ttf', '.otf', '.eot'
])

const appConfig: Config = loadConfig()

interface NetworkEntry {
  name: string
  address: string
}

interface DeviceInfo {
  userAgent: string
  platform: string
  maxTouchPoints?: number
  isIOS: boolean
}

interface ClientState {
  playerId: number
  buttons: Set<string>
  axes: Map<string, number>
  soundEnabled: boolean
  vibrationEnabled: boolean
  layout: string
  deviceInfo?: DeviceInfo
}

function getLocalIps(): NetworkEntry[] {
  const entries: NetworkEntry[] = []
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        entries.push({ name, address: iface.address })
      }
    }
  }
  return entries
}

function isLikelyVirtual(name: string): boolean {
  return /virtual|vpn|warp|wsl|hyper-v|vmware|virtualbox|docker|zerotier|tailscale/i.test(name)
}

function isWiredOrWireless(name: string): boolean {
  return /^(wi-?fi|wlan|wireless|ethernet|eth|en)\b/i.test(name.trim())
}

function isPrivateIp(address: string): boolean {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(address)
  )
}

function pickBestIp(entries: NetworkEntry[]): string {
  if (entries.length === 0) return '127.0.0.1'

  const realInterfaces = entries.filter((e) => !isLikelyVirtual(e.name))
  const candidates = realInterfaces.length > 0 ? realInterfaces : entries

  const wiredOrWireless = candidates.find((e) => isWiredOrWireless(e.name))
  if (wiredOrWireless) return wiredOrWireless.address

  const privateIp = candidates.find((e) => isPrivateIp(e.address))
  if (privateIp) return privateIp.address

  return candidates[0].address
}

function timestamp(): string {
  return new Date().toLocaleTimeString('es-ES', { hour12: false })
}

function log(message: string): void {
  console.log(`[${timestamp()}] ${message}`)
}

function detectIOS(userAgent: string, platform: string, maxTouchPoints?: number): boolean {
  const isAppleMobile = /iPad|iPhone|iPod/.test(userAgent)
  const isIPadModern = platform === 'MacIntel' && (maxTouchPoints || 0) > 1
  return isAppleMobile || isIPadModern
}

function handleWebButton(playerId: number, name: string, pressed: boolean): void {
  switch (name) {
    case 'LB':
      setButton(playerId, 'LEFT_SHOULDER', pressed)
      break
    case 'RB':
      setButton(playerId, 'RIGHT_SHOULDER', pressed)
      break
    case 'LT':
      setAxis(playerId, 'leftTrigger', pressed ? 1 : 0)
      break
    case 'RT':
      setAxis(playerId, 'rightTrigger', pressed ? 1 : 0)
      break
    case 'SE':
      setButton(playerId, 'BACK', pressed)
      break
    case 'ST':
      setButton(playerId, 'START', pressed)
      break
    case 'L3':
      setButton(playerId, 'LEFT_THUMB', pressed)
      break
    case 'R3':
      setButton(playerId, 'RIGHT_THUMB', pressed)
      break
    case 'BA':
      setButton(playerId, 'A', pressed)
      break
    case 'BB':
      setButton(playerId, 'B', pressed)
      break
    case 'BX':
      setButton(playerId, 'X', pressed)
      break
    case 'BY':
      setButton(playerId, 'Y', pressed)
      break
    default:
      setButton(playerId, name as ButtonName, pressed)
      break
  }
}

function releaseClientState(state: ClientState): void {
  const { playerId } = state
  if (!isGamepadClientConnected()) return

  for (const button of state.buttons) {
    handleWebButton(playerId, button, false)
  }

  for (const axis of state.axes.keys()) {
    setAxis(playerId, axis as AxisName, 0)
  }
}

function sendSettings(ws: any, state: ClientState): void {
  try {
    ws.send(
      JSON.stringify({
        type: 'settings',
        soundEnabled: state.soundEnabled,
        vibrationEnabled: state.vibrationEnabled,
        layout: state.layout
      })
    )
  } catch {
    // Ignorar errores al enviar
  }
}

const availablePlayerIds: number[] = []
let nextPlayerId = 1

function assignPlayerId(): number {
  if (availablePlayerIds.length > 0) {
    return availablePlayerIds.shift()!
  }
  return nextPlayerId++
}

function releasePlayerId(playerId: number): void {
  if (!availablePlayerIds.includes(playerId)) {
    availablePlayerIds.push(playerId)
    availablePlayerIds.sort((a, b) => a - b)
  }
}

function getClientByPlayerId(playerId: number): { ws: any; state: ClientState } | null {
  for (const [ws, state] of clientStates.entries()) {
    if (state.playerId === playerId) {
      return { ws, state }
    }
  }
  return null
}

function serializeClients() {
  const clients: Array<{
    playerId: number
    remoteAddress: string
    buttonsCount: number
    axesCount: number
    soundEnabled: boolean
    vibrationEnabled: boolean
    layout: string
    deviceInfo?: DeviceInfo
  }> = []

  for (const [ws, state] of clientStates.entries()) {
    clients.push({
      playerId: state.playerId,
      remoteAddress: ws.remoteAddress || 'desconocida',
      buttonsCount: state.buttons.size,
      axesCount: state.axes.size,
      soundEnabled: state.soundEnabled,
      vibrationEnabled: state.vibrationEnabled,
      layout: state.layout,
      deviceInfo: state.deviceInfo
    })
  }

  return clients.sort((a, b) => a.playerId - b.playerId)
}



async function serveStaticFile(pathname: string): Promise<Bun.BunFile | null> {
  if (pathname === '/') {
    return Bun.file(path.join(PUBLIC_DIR, 'index.html'))
  }

  const ext = path.extname(pathname).toLowerCase()
  if (!STATIC_EXTENSIONS.has(ext)) {
    return null
  }

  const safePath = path.normalize(path.join(PUBLIC_DIR, pathname))
  if (!safePath.startsWith(PUBLIC_DIR)) {
    return null
  }

  const file = Bun.file(safePath)
  if (!(await file.exists())) {
    return null
  }

  return file
}

const APP_DATA_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'Mando')
const USER_LAYOUTS_DIR = path.join(APP_DATA_DIR, 'layouts')

const localIps = getLocalIps()
const localIp = pickBestIp(localIps)
const clientStates = new Map<any, ClientState>()

let bonjour: any = null
let service: any = null
try {
  bonjour = new Bonjour()
  service = bonjour.publish({
    name: HOSTNAME,
    type: 'http',
    port: PORT,
    host: `${HOSTNAME}.local`,
    txt: { path: '/' }
  })
  log(`Servicio mDNS anunciado: ${HOSTNAME}._http._tcp.local`)
} catch (error) {
  log(`⚠️ mDNS/Bonjour no disponible: ${error}`)
  log('El servidor seguirá funcionando. Conecta los dispositivos usando la IP local.')
}

log('Iniciando servidor...')
if (localIps.length === 0) {
  log('No se detectaron interfaces de red locales.')
} else {
  for (const { name, address } of localIps) {
    const marker = address === localIp ? ' (usada)' : ''
    log(`Interfaz ${name}: ${address}${marker}`)
  }
}
log(`Puerto: ${PORT}`)

let gamepadStatus = await initGamepad()
if (gamepadStatus.ok) {
  log('Cliente ViGEm inicializado correctamente')
} else {
  // Try auto-install if the driver is missing (skip if env var set, e.g. during build smoke test)
  const skipInstall = process.env.MANDO_SKIP_VIGEM_INSTALL === '1'
  if (!skipInstall && (gamepadStatus.error?.includes('BUS_NOT_FOUND') || gamepadStatus.error?.includes('BUS_ACCESS_FAILED'))) {
    log('⚠️ ViGEmBus no detectado. Intentando instalación automática...')
    if (!isViGEmBusInstalled()) {
      const result = await installViGEmBus()
      if (result.status === 'installed_and_loaded') {
        log('✓ ViGEmBus instalado y cargado correctamente')
        gamepadStatus = await initGamepad()
        if (gamepadStatus.ok) {
          log('Cliente ViGEm inicializado correctamente')
        }
      } else if (result.status === 'need_reboot') {
        log('⚠️ ViGEmBus instalado. Se necesita reiniciar para activar los mandos virtuales.')
      } else if (result.status === 'no_installer') {
        log('⚠️ No se pudo extraer el instalador de ViGEmBus del ejecutable.')
      } else if (result.status === 'error') {
        log(`⚠️ Error instalando ViGEmBus: ${result.message}`)
      }
    }
  }

  if (!gamepadStatus.ok) {
    log(`⚠️ ViGEm no disponible: ${gamepadStatus.error}`)
    log('El servidor seguirá funcionando, pero no se crearán mandos virtuales.')
  }
}

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  async fetch(req, server) {
    const url = new URL(req.url)

    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req)
      if (upgraded) {
        return undefined as unknown as Response
      }
      return new Response('WebSocket upgrade failed', { status: 500 })
    }

    if (url.pathname === '/health') {
      const mdns = bonjour ? `${HOSTNAME}.local:${PORT}` : null
      return new Response(
        JSON.stringify({
          status: 'ok',
          time: new Date().toISOString(),
          localIp,
          port: PORT,
          mdns,
          gamepadClient: isGamepadClientConnected(),
          activeControllers: getActiveControllersCount()
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (url.pathname === '/admin') {
      return new Response(Bun.file(path.join(PUBLIC_DIR, 'admin.html')))
    }

    if (url.pathname === '/api/status') {
      const mdns = bonjour ? `${HOSTNAME}.local:${PORT}` : null
      return new Response(
        JSON.stringify({
          status: 'ok',
          time: new Date().toISOString(),
          localIp,
          port: PORT,
          mdns,
          gamepadClient: isGamepadClientConnected(),
          activeControllers: getActiveControllersCount()
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (url.pathname === '/api/layouts') {
      if (req.method === 'GET') {
        const files: { id: string; name: string }[] = []
        for (const dir of [path.join(PUBLIC_DIR, 'layouts'), USER_LAYOUTS_DIR]) {
          if (!existsSync(dir)) continue
          for (const entry of readdirSync(dir)) {
            if (!entry.endsWith('.json')) continue
            try {
              const data = JSON.parse(readFileSync(path.join(dir, entry), 'utf-8'))
              if (!files.some(f => f.id === data.id)) files.push({ id: data.id, name: data.name })
            } catch {}
          }
        }
        return new Response(JSON.stringify(files), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
      if (req.method === 'POST') {
        const body = await req.json()
        const { id, name, areas } = body
        if (!id || !name || !areas) {
          return new Response(JSON.stringify({ error: 'Faltan campos: id, name, areas' }), { status: 400 })
        }
        if (!/^[a-z0-9-]+$/.test(id)) {
          return new Response(JSON.stringify({ error: 'id inválido: solo alfanumérico y guiones' }), { status: 400 })
        }
        mkdirSync(USER_LAYOUTS_DIR, { recursive: true })
        writeFileSync(path.join(USER_LAYOUTS_DIR, `${id}.json`), JSON.stringify({ id, name, areas }, null, 2))
        log(`Layout guardado: ${id}`)
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    const layoutMatch = url.pathname.match(/^\/api\/layouts\/(.+)$/)
    if (layoutMatch) {
      const id = layoutMatch[1]
      if (req.method === 'GET') {
        const userPath = path.join(USER_LAYOUTS_DIR, `${id}.json`)
        if (existsSync(userPath)) {
          return new Response(Bun.file(userPath))
        }
        const builtinPath = path.join(PUBLIC_DIR, 'layouts', `${id}.json`)
        if (await Bun.file(builtinPath).exists()) {
          return new Response(Bun.file(builtinPath))
        }
        return new Response(JSON.stringify({ error: 'Layout no encontrado' }), { status: 404 })
      }
      if (req.method === 'DELETE') {
        const userPath = path.join(USER_LAYOUTS_DIR, `${id}.json`)
        if (existsSync(userPath)) {
          unlinkSync(userPath)
          log(`Layout eliminado: ${id}`)
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          })
        }
        return new Response(JSON.stringify({ error: 'Layout no encontrado' }), { status: 404 })
      }
    }

    if (url.pathname === '/api/clients') {
      return new Response(
        JSON.stringify(serializeClients()),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const settingsMatch = url.pathname.match(/^\/api\/clients\/(\d+)\/settings$/)
    if (settingsMatch && req.method === 'POST') {
      const playerId = parseInt(settingsMatch[1], 10)
      const entry = getClientByPlayerId(playerId)
      if (!entry) {
        return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      try {
        const body = await req.json()
        if (typeof body.soundEnabled === 'boolean') {
          entry.state.soundEnabled = body.soundEnabled
        }
        if (typeof body.vibrationEnabled === 'boolean') {
          entry.state.vibrationEnabled = body.vibrationEnabled
        }
        if (typeof body.layout === 'string' && body.layout !== entry.state.layout) {
          entry.state.layout = body.layout
          appConfig.defaultLayout = body.layout
          saveConfig(appConfig)
        }
        sendSettings(entry.ws, entry.state)
        log(`Ajustes actualizados para Mando ${playerId}: sonido=${entry.state.soundEnabled}, vibración=${entry.state.vibrationEnabled}, layout=${entry.state.layout}`)
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        })
      } catch {
        return new Response(JSON.stringify({ error: 'Body inválido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    if (url.pathname === '/api/qr') {
      const targetUrl = url.searchParams.get('url') || `http://${localIp}:${PORT}/`
      try {
        const svg = await QRCode.toString(targetUrl, { type: 'svg', margin: 2 })
        return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } })
      } catch (error) {
        return new Response('Error generando QR', { status: 500 })
      }
    }

    const publicFile = await serveStaticFile(url.pathname)
    if (publicFile) {
      return new Response(publicFile)
    }

    return new Response('Not found', { status: 404 })
  },
  websocket: {
    open(ws) {
      const playerId = assignPlayerId()
      log(`WebSocket conectado desde ${ws.remoteAddress} (Mando ${playerId})`)

      const controllerStatus = createController(playerId)
      if (controllerStatus.ok) {
        log(`Mando virtual Xbox 360 asignado al Mando ${playerId}`)
      } else {
        log(`⚠️ No se pudo asignar mando al Mando ${playerId}: ${controllerStatus.error}`)
      }

      const state: ClientState = {
        playerId,
        buttons: new Set(),
        axes: new Map(),
        soundEnabled: true,
        vibrationEnabled: true,
        layout: appConfig.defaultLayout
      }
      clientStates.set(ws, state)

      ws.send(
        JSON.stringify({
          type: 'hello',
          playerId,
          soundEnabled: state.soundEnabled,
          vibrationEnabled: state.vibrationEnabled,
          layout: state.layout,
          message: `Conectado como Mando ${playerId}`
        })
      )
    },
    message(ws, message) {
      const state = clientStates.get(ws)
      if (!state) return

      const { playerId } = state
      const text =
        typeof message === 'string'
          ? message
          : new TextDecoder().decode(message as ArrayBuffer | Uint8Array)
      try {
        const data = JSON.parse(text)
        if (data.type === 'button_down') {
          log(`Botón ${data.button || '?'} pulsado desde Mando ${playerId}`)
          state.buttons.add(data.button)
          if (isGamepadClientConnected()) {
            handleWebButton(playerId, data.button, true)
          }
        } else if (data.type === 'button_up') {
          log(`Botón ${data.button || '?'} soltado desde Mando ${playerId}`)
          state.buttons.delete(data.button)
          if (isGamepadClientConnected()) {
            handleWebButton(playerId, data.button, false)
          }
        } else if (data.type === 'axis') {
          log(`Eje ${data.axis || '?'} = ${data.value} desde Mando ${playerId}`)
          state.axes.set(data.axis, Number(data.value))
          if (isGamepadClientConnected()) {
            setAxis(playerId, data.axis as AxisName, Number(data.value))
          }
        } else if (data.type === 'device_info') {
          const userAgent = String(data.userAgent || '')
          const platform = String(data.platform || '')
          const maxTouchPoints = typeof data.maxTouchPoints === 'number' ? data.maxTouchPoints : undefined
          const clientIsIOS = typeof data.isIOS === 'boolean' ? data.isIOS : detectIOS(userAgent, platform, maxTouchPoints)
          state.deviceInfo = {
            userAgent,
            platform,
            maxTouchPoints,
            isIOS: clientIsIOS
          }
          if (typeof data.layout === 'string') {
            state.layout = data.layout
          }
          log(`Información de dispositivo recibida de Mando ${playerId}: ${platform || 'desconocido'}, layout=${state.layout}`)
        } else {
          log(`Mensaje WS desde Mando ${playerId}: ${text}`)
        }
      } catch {
        log(`Mensaje WS crudo desde Mando ${playerId}: ${text}`)
      }
    },
    close(ws) {
      const state = clientStates.get(ws)
      if (state) {
        const { playerId } = state
        log(`WebSocket desconectado desde Mando ${playerId}`)
        log(`Liberando botones, ejes y mando virtual del Mando ${playerId}`)
        releaseClientState(state)
        releaseController(playerId)
        releasePlayerId(playerId)
        clientStates.delete(ws)
      } else {
        log(`WebSocket desconectado desde ${ws.remoteAddress}`)
      }
    }
  }
})

log(`Servidor HTTP + WS escuchando en http://${localIp}:${PORT}`)
if (bonjour) {
  log(`URL mDNS: http://${HOSTNAME}.local:${PORT}`)
}

const adminUrl = bonjour
  ? `http://${HOSTNAME}.local:${PORT}/admin`
  : `http://${localIp}:${PORT}/admin`

let tray: any = null
try {
  tray = initTray(adminUrl, () => {
    log('Cerrando servidor desde tray...')
    if (service) {
      service.stop(() => {
        process.exit(0)
      })
    } else {
      process.exit(0)
    }
  })
  log('Tray icon inicializado')
} catch (error) {
  log(`⚠️ No se pudo inicializar el tray icon: ${error}`)
}

const isAutoStart = process.argv.includes('--autostart')

if (!isAutoStart) {
  log(`Abriendo panel de admin: ${adminUrl}`)
  exec(`start "" "${adminUrl}"`, { windowsHide: true })
}

process.on('SIGINT', () => {
  log('Cerrando servidor y anuncio mDNS...')
  if (service) {
    service.stop(() => {
      process.exit(0)
    })
  } else {
    process.exit(0)
  }
})
