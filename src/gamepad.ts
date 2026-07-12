import { loadVigemClient } from './vigem-loader.js'

export type ButtonName =
  | 'A'
  | 'B'
  | 'X'
  | 'Y'
  | 'START'
  | 'BACK'
  | 'LEFT_SHOULDER'
  | 'RIGHT_SHOULDER'
  | 'LEFT_THUMB'
  | 'RIGHT_THUMB'
  | 'GUIDE'

export type AxisName =
  | 'leftX'
  | 'leftY'
  | 'rightX'
  | 'rightY'
  | 'leftTrigger'
  | 'rightTrigger'
  | 'dpadHorz'
  | 'dpadVert'

interface GamepadState {
  ok: boolean
  error?: string
}

interface ControllerEntry {
  playerId: number
  controller: any
}

let ViGEmClient: any = null
let client: any = null
let clientConnected = false
const controllers = new Map<number, ControllerEntry>()

export async function initGamepad(): Promise<GamepadState> {
  try {
    ViGEmClient = await loadVigemClient()
    client = new ViGEmClient()
    const connectError = client.connect()

    if (connectError) {
      return {
        ok: false,
        error: formatViGEmError(connectError.message)
      }
    }

    clientConnected = true
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function createController(playerId: number): GamepadState {
  if (!clientConnected || !client) {
    return {
      ok: false,
      error: 'ViGEmClient no está conectado. ¿Está instalado el driver ViGEmBus?'
    }
  }

  if (controllers.has(playerId)) {
    return {
      ok: false,
      error: `Ya existe un mando asignado al player ${playerId}`
    }
  }

  try {
    const controller = client.createX360Controller()
    const targetError = controller.connect()

    if (targetError) {
      return {
        ok: false,
        error: formatViGEmError(targetError.message)
      }
    }

    controller.updateMode = 'manual'
    controllers.set(playerId, { playerId, controller })
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function releaseController(playerId: number): void {
  const entry = controllers.get(playerId)
  if (!entry) return

  try {
    entry.controller.disconnect()
  } catch {
    // Ignorar errores al desconectar
  }

  controllers.delete(playerId)
}

export function setButton(playerId: number, name: ButtonName, pressed: boolean): void {
  const entry = controllers.get(playerId)
  if (!entry) return

  const { controller } = entry
  if (controller.button[name]) {
    controller.button[name].setValue(pressed)
    controller.update()
  }
}

export function setAxis(playerId: number, name: AxisName, value: number): void {
  const entry = controllers.get(playerId)
  if (!entry) return

  const { controller } = entry
  if (controller.axis[name]) {
    controller.axis[name].setValue(value)
    controller.update()
  }
}

export function isGamepadClientConnected(): boolean {
  return clientConnected
}

export function getActiveControllersCount(): number {
  return controllers.size
}

function formatViGEmError(message: string): string {
  if (
    message.includes('VIGEM_ERROR_BUS_NOT_FOUND') ||
    message.includes('VIGEM_ERROR_BUS_ACCESS_FAILED') ||
    message.includes('VIGEM_ERROR_BUS_VERSION_MISMATCH')
  ) {
    return `${message}. Parece que el driver ViGEmBus no está instalado o no está corriendo. Ejecuta como administrador: winget install -e --id ViGEm.ViGEmBus y reinicia el PC.`
  }
  return message
}
