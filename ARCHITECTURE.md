# ARCHITECTURE.md — Mando

Este documento describe la arquitectura técnica del proyecto para que un agente pueda entender el código sin revisar todos los archivos.

## Componentes principales

### 1. Servidor (`src/server.ts`)

Arranca un servidor HTTP/WebSocket con `Bun.serve`. Publica el servicio vía mDNS usando `bonjour-service` con fallback: si Bonjour no está instalado, el servidor sigue funcionando usando la IP local.

#### Rutas HTTP

| Ruta | Descripción |
|------|-------------|
| `GET /` | Sirve `src/public/index.html` (webapp del mando). |
| `GET /health` | Devuelve JSON con estado, IP local, puerto, mDNS, ViGEm y mandos activos. |
| `GET /admin` | Sirve `src/public/admin.html` (panel de administración). |
| `GET /api/status` | Igual que `/health`. |
| `GET /api/clients` | Lista de clientes conectados. |
| `POST /api/clients/:id/settings` | Actualiza ajustes (sonido/vibración/layout) de un cliente. |
| `GET /api/qr` | Genera código QR SVG para una URL. |
| `GET /api/layouts` | Lista layouts disponibles (built-in + usuario). |
| `POST /api/layouts` | Guarda un nuevo layout de usuario. |
| `GET /api/layouts/:id` | Devuelve un layout por ID (built-in o usuario). |
| `DELETE /api/layouts/:id` | Elimina un layout de usuario. |
| `GET /ws` | Upgrade a WebSocket. |

#### WebSocket

Mensajes que acepta el servidor (formato JSON):

```json
{ "type": "button_down", "button": "A" }
{ "type": "button_up",   "button": "A" }
{ "type": "axis",        "axis": "leftX", "value": 0.52 }
{ "type": "device_info", "userAgent": "...", "platform": "...", "maxTouchPoints": 5, "isIOS": true }
```

Mensajes que envía el servidor:

```json
{ "type": "hello", "playerId": 1, "soundEnabled": true, "vibrationEnabled": true, "message": "Conectado como Mando 1" }
{ "type": "settings", "soundEnabled": true, "vibrationEnabled": false }
```

#### Mapeo de botones web → mando Xbox 360

Los layouts usan códigos cortos (definidos en `diccionario.js`). El servidor los mapea a botones Xbox 360 en `handleWebButton()`:

| Código layout | ViGEm/Xbox 360 |
|---------------|----------------|
| A, B, X, Y | A, B, X, Y (vía eventos nativos del pad) |
| SE | BACK (SELECT) |
| ST | START |
| LB | LEFT_SHOULDER |
| RB | RIGHT_SHOULDER |
| LT | `leftTrigger` (eje 0-1) |
| RT | `rightTrigger` (eje 0-1) |
| L3 | LEFT_THUMB |
| R3 | RIGHT_THUMB |
| LS (joystick) | `leftX`, `leftY` |
| RS (joystick) | `rightX`, `rightY` |

#### Estado por cliente

```ts
interface ClientState {
  playerId: number
  buttons: Set<string>
  axes: Map<string, number>
  soundEnabled: boolean
  vibrationEnabled: boolean
  layout: string
  deviceInfo?: { userAgent: string; platform: string; maxTouchPoints?: number; isIOS: boolean }
}
```

Se guarda en `clientStates` (Map de WebSocket → ClientState). Al desconectar se libera el estado llamando a `releaseClientState`, que suelta todos los botones, resetea los ejes a 0 y libera el mando virtual ViGEm.

#### Selección de IP local

El servidor detecta todas las interfaces IPv4 no internas, descarta interfaces virtuales/VPN/WSL y prioriza Ethernet/Wi-Fi con IP privada.

#### Fallback mDNS

Si `new Bonjour()` o `bonjour.publish()` fallan (porque no hay resolvedor mDNS instalado), el servidor lo captura con try-catch y continúa sin mDNS. El panel admin se abre con la IP local en lugar de `mando.local`, y el campo `mdns` en las APIs es `null`.

### 2. Mando virtual (`src/gamepad.ts`)

Wrapper sobre `vigemclient` (CommonJS + addon nativo N-API). Soporta múltiples mandos virtuales simultáneos, uno por dispositivo conectado.

- `initGamepad()`: conecta con ViGEmClient (una sola instancia compartida).
- `createController(playerId)`: crea un nuevo `X360Controller` para un dispositivo.
- `releaseController(playerId)`: desconecta y libera el mando de un dispositivo.
- `setButton(playerId, name, pressed)`: pulsa/suelta un botón en un mando específico.
- `setAxis(playerId, name, value)`: establece un eje o trigger en un mando específico.
- `isGamepadClientConnected()`: indica si ViGEmClient está conectado al driver.
- `getActiveControllersCount()`: número de mandos virtuales activos.
- `controller.updateMode = 'manual'`: los cambios no se envían al driver hasta llamar a `controller.update()`.

### 2.5 Auto-instalación de ViGEmBus (`src/vigem-installer.ts`)

En primera ejecución, si `initGamepad()` falla con `BUS_NOT_FOUND` o `BUS_ACCESS_FAILED`, el servidor intenta instalar ViGEmBus automáticamente:

1. Extrae el installer desde el ejecutable (o desde `assets/ViGEmBus_*.exe.bin` en dev).
2. Verifica si tiene permisos de admin. Si no, se re-lanza como administrador y termina.
3. Ejecuta el installer en modo silencioso (`/exenoui /qn /norestart`).
4. Intenta iniciar el servicio del driver.
5. Si necesita reinicio, lo notifica.

El instalador de ViGEmBus se embebe en el ejecutable compilado. En desarrollo, debe descargarse manualmente:
```
curl -L -o assets/ViGEmBus_1.22.0_x64_x86_arm64.exe <url>
copy assets/ViGEmBus_*.exe assets/ViGEmBus_*.exe.bin
```

### 3. Webapp táctil (Web Components)

La webapp está construida con Web Components nativos (custom elements) y un grid engine declarativo configurable por JSON.

#### Componentes

| Componente | Archivo | Propósito |
|------------|---------|-----------|
| `<mando-gamepad>` | `components/mando-gamepad.js` | Orquestador: gestiona WS, audio, háptico, settings, layout |
| `<mando-button>` | `components/mando-button.js` | Botón táctil con glow radial + neón interior |
| `<mando-joystick>` | `components/mando-joystick.js` | Joystick analógico con deadzone |
| `<mando-pad>` | `components/mando-pad.js` | Pad multifunción (ABXY, dpad, AB, ABX) con detección angular y multitouch |
| `<grid-engine>` | `components/grid-engine.js` | Construye la UI desde un JSON de layout |

#### Grid Engine

`grid-engine.js` recibe un JSON con:
- `areas`: matriz 6×12 de códigos (ej. `LT`, `LS`, `SE`, `AY`).
- `components` (opcional): override por código.

Construye un CSS Grid con `grid-template-areas` y crea el componente adecuado para cada código según `diccionario.js`.

#### Layouts

Los layouts son archivos JSON en `src/public/layouts/`. Ejemplo (`default.json` — Xbox):
```json
{
  "id": "default",
  "name": "Xbox",
  "areas": [
    "LT LT LT LT LB LB RB RB RT RT RT RT",
    ...
    "LS LS LS LS SE RS RS RS AY AY AY AY",
    ...
  ]
}
```

Layouts disponibles: Xbox, GameBoy (D-Pad/Joystick), Arcade (D-Pad/Joystick, ABC), Fighter (D-Pad/Joystick), Racing, Shooter. Los layouts de usuario se guardan en `%APPDATA%/Mando/layouts/`.

#### Diccionario de códigos (`layouts/diccionario.js`)

| Código | Tipo | Descripción |
|--------|------|-------------|
| `SE` | button | SELECT |
| `ST` | button | START |
| `LT`, `LB`, `RB`, `RT` | button | Shoulders/triggers |
| `L3`, `R3` | button | Thumbsticks click |
| `AY` | pad (abxy) | ABXY |
| `PD` | pad (dpad) | D-Pad direccional |
| `AB` | pad (ab) | A + B |
| `AX`/`ABX` | pad (abx) | A + B + X |
| `LS`, `RS` | joystick | Joysticks analógicos |

#### Feedback

- Visual: clase `.active` + glow radial que sigue al dedo (250px, blur 44px) + neón interior fino.
- Háptico: `navigator.vibrate(8)` (no disponible en iOS Safari).
- Sonoro: Web Audio API con osciladores `triangle` + `square`, estilo "tac-tac".

#### Conexión

- WebSocket a `ws://${location.host}/ws`.
- Reconexión automática cada 1 segundo.
- Indicador de estado flotante (`#status`).

#### Estilos

- TailwindCSS v4.3.2 con `@tailwindcss/postcss`.
- `styles-input.css` → `styles.css` mediante PostCSS.
- `@source` con rutas absolutas (relativas fallan en Windows+Bun).

## Flujo de datos

```
[iPhone webapp]
       │ pointer events
       ▼
[WebSocket over WiFi]
       │
       ▼
[Bun server] ──► [ViGEmClient] ──► [ViGEmBus driver] ──► [Windows / juegos]
       │
       ▼
[mDNS / Bonjour: mando.local] (fallback a IP local si no hay Bonjour)
```

## Decisiones técnicas clave

- **Web Components modulares**: `index.html` es un esqueleto mínimo que carga componentes nativos. No hay framework ni bundler.
- **`Bun.file()` para servir HTML**: el servidor lee `index.html` desde disco.
- **No hay base de datos ni persistencia**: todo es estado en memoria.
- **mDNS con fallback**: se anuncia `mando.local` para facilitar la conexión. Si falta Bonjour, se usa IP local.
- **`vigemclient` con `require()`**: aunque el proyecto es ESM, el addon nativo requiere `require()`.
- **TailwindCSS v4 via PostCSS**: no se usa el CLI de Tailwind ni Vite. `@source` con rutas absolutas porque las relativas fallan en Windows+Bun.

## Puntos de fricción conocidos

- ViGEmBus requiere privilegios de administrador para instalarse.
- `mando.local` puede no resolverse si Windows no tiene un resolvedor mDNS instalado. (Manejado con fallback.)
- `vigemclient` tiene un addon nativo; `bun build --compile` embebe el `.node` y la DLL.
- El altavoz del iPhone no reproduce bien frecuencias muy graves; el sonido se ha ajustado a "tac-tac" seco.
- Los antivirus pueden detectar falsos positivos por: binario sin firmar, driver kernel embebido, y modificación del subsistema PE.
- En desarrollo, `vigem-installer.ts` requiere el archivo `assets/ViGEmBus_*.exe.bin` (en `.gitignore`). Descargar manualmente tras el clone.
- `styles-input.css` tiene `@source` con ruta absoluta (`C:/Users/verdu/mando/...`). Solo funciona en el PC del desarrollador.
