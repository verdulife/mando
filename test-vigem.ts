const ViGEmClient = require('vigemclient');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function classifyError(error: unknown): { category: 'driver' | 'bun-native' | 'other'; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack || '' : '';
  const full = `${raw}\n${stack}`.toLowerCase();

  // a) Driver no instalado / no corriendo
  if (
    raw.includes('VIGEM_ERROR_BUS_NOT_FOUND') ||
    raw.includes('VIGEM_ERROR_BUS_ACCESS_FAILED') ||
    raw.includes('VIGEM_ERROR_BUS_VERSION_MISMATCH') ||
    raw.includes('no se encuentra') ||
    raw.includes('not found') ||
    raw.includes('device') && raw.includes('driver')
  ) {
    return {
      category: 'driver',
      message: `Parece que el driver ViGEmBus no está instalado o no está corriendo.\nSugerencia: ejecuta como administrador:\n  winget install -e --id ViGEm.ViGEmBus\nY reinicia el PC.`
    };
  }

  // b) Fallo de carga del addon nativo bajo Bun
  if (
    raw.includes('not a valid win32 application') ||
    raw.includes('symbol not found') ||
    raw.includes('cannot find module') ||
    raw.includes('cannot load') ||
    raw.includes('node-gyp') ||
    raw.includes('.node') ||
    raw.includes('was compiled against a different node.js version') ||
    raw.includes('module did not self-register') ||
    raw.includes('error loading') ||
    full.includes('require') && full.includes('build/release/vigemclient')
  ) {
    return {
      category: 'bun-native',
      message: `Esto probablemente es incompatibilidad de Bun con este addon N-API, o el addon nativo no se compiló correctamente.\nHay que ejecutar esta lógica bajo Node.js en vez de Bun.`
    };
  }

  return {
    category: 'other',
    message: `Error inesperado: ${raw}\n${stack}`
  };
}

async function main() {
  console.log('[test-vigem] Iniciando prueba de ViGEmClient...');
  console.log('[test-vigem] Runtime:', typeof Bun !== 'undefined' ? 'Bun' : 'Node.js');

  let client: InstanceType<typeof ViGEmClient> | null = null;
  let controller: any = null;

  try {
    console.log('[test-vigem] Paso 1/5: Importando vigemclient...');
    // La importación ya se hizo arriba, pero la dejamos documentada.
    console.log('[test-vigem] vigemclient importado correctamente');

    console.log('[test-vigem] Paso 2/5: Creando cliente y conectando con ViGEmBus...');
    client = new ViGEmClient();
    const connectError = client.connect();
    if (connectError) {
      throw connectError;
    }
    console.log('[test-vigem] Conectado con ViGEmBus');
    console.log('[test-vigem] Mando virtual creado, Windows debería detectarlo ahora');

    console.log('[test-vigem] Paso 3/5: Creando X360Controller virtual...');
    controller = client.createX360Controller();
    controller.connect();
    console.log('[test-vigem] X360Controller conectado (plug in)');

    console.log('[test-vigem] Paso 4/5: Moviendo stick izquierdo (leftX = 0.5)...');
    controller.axis.leftX.setValue(0.5);
    controller.update();
    await sleep(1000);

    console.log('[test-vigem] Pulsando botón A...');
    controller.button.A.setValue(true);
    controller.update();
    await sleep(1000);

    console.log('[test-vigem] Soltando botón A...');
    controller.button.A.setValue(false);
    controller.axis.leftX.setValue(0);
    controller.update();
    await sleep(300);

    console.log('[test-vigem] Paso 5/5: Desconectando mando...');
    controller.disconnect();
    console.log('[test-vigem] Mando desconectado');

    console.log('[test-vigem] ✅ Prueba completada con éxito');
  } catch (error) {
    const { category, message } = classifyError(error);

    console.error('[test-vigem] ❌ Prueba fallida');
    console.error(`[test-vigem] Categoría del error: ${category}`);
    console.error(`[test-vigem] ${message}`);

    if (category === 'other') {
      console.error('[test-vigem] Error completo:', error);
    }
  } finally {
    if (controller && typeof controller.disconnect === 'function') {
      try {
        controller.disconnect();
      } catch {
        // ignorar
      }
    }
    process.exit(0);
  }
}

main();
