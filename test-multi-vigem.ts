const ViGEmClient = require('vigemclient')

const CONTROLLER_COUNT = 4
const DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log(`[TEST] Creando ${CONTROLLER_COUNT} mandos virtuales Xbox 360...`)

  const client = new ViGEmClient()
  const connectError = client.connect()
  if (connectError) {
    console.error('[TEST] Error al conectar ViGEmClient:', connectError.message)
    process.exit(1)
  }

  const controllers: any[] = []

  for (let i = 0; i < CONTROLLER_COUNT; i++) {
    const controller = client.createX360Controller()
    const targetError = controller.connect()
    if (targetError) {
      console.error(`[TEST] Error al conectar mando ${i + 1}:`, targetError.message)
      process.exit(1)
    }
    controller.updateMode = 'manual'
    controllers.push(controller)
    console.log(`[TEST] Mando ${i + 1} creado y conectado.`)
  }

  console.log('[TEST] Abre joy.cpl (Win + R → joy.cpl) para ver los mandos.')
  console.log('[TEST] Moviendo joystick izquierdo de cada mando en secuencia...')

  for (let i = 0; i < controllers.length; i++) {
    const controller = controllers[i]
    console.log(`[TEST] Mando ${i + 1}: joystick izquierdo a la derecha.`)
    controller.axis.leftX.setValue(0.75)
    controller.update()
    await sleep(DELAY_MS)

    console.log(`[TEST] Mando ${i + 1}: joystick izquierdo al centro.`)
    controller.axis.leftX.setValue(0)
    controller.update()
    await sleep(500)
  }

  console.log('[TEST] Desconectando mandos...')
  for (const controller of controllers) {
    controller.disconnect()
  }

  console.log('[TEST] Prueba finalizada.')
}

main().catch((error) => {
  console.error('[TEST] Error inesperado:', error)
  process.exit(1)
})
