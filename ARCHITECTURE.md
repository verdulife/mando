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
| `POST /api/clients/:id/settings` | Actualiza ajustes (sonido/vibración) de un cliente. |
| `GET /api/qr` | Genera código QR SVG para una URL. |
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

| Webapp | ViGEm/Xbox 360 |
|--------|----------------|
| A, B, X, Y | A, B, X, Y |
| START | START |
| SELECT | BACK |
| LB | LEFT_SHOULDER |
| RB | RIGHT_SHOULDER |
| LT | `leftTrigger` (eje 0-1) |
| RT | `rightTrigger` (eje 0-1) |
| Joystick izquierdo | `leftX`, `leftY` |
| Joystick derecho | `rightX`, `rightY` |

#### Estado por cliente

```ts
interface ClientState {
  playerId: number
  buttons: Set<string>
  axes: Map<string, number>
  soundEnabled: boolean
  vibrationEnabled: boolean
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

### 3. Webapp táctil (`src/public/index.html`)

Aplicación web autocontenida (HTML + CSS + JS inline).

#### Estilos

- TailwindCSS v4.3.2 con `@tailwindcss/postcss`.
- `src/public/styles-input.css`: fuente de estilos con `@import "tailwindcss"`, `@theme` (colores custom: `--color-bg`, `--color-panel`, `--color-text`, etc.), `@layer base/components`.
- Build: `scripts/build-css.ts` usa PostCSS API para procesar `styles-input.css` → `styles.css`.
- `@source` con rutas absolutas (`C:/Users/verdu/mando/src/public/**/*.html`) porque las relativas fallan en Windows+Bun.
- Clases arbitrarias: `grid-rows-[1fr_2fr]`, `top-[6%]`, `text-[#f5d742]`, etc.

#### Layout

Grid CSS de 12 columnas:

- **Fila superior (`#top-row`)**: proporciones `4fr 2fr 2fr 4fr`.
  - LT (4), LB (2), RB (2), RT (4).
- **Fila inferior (`#main-grid`)**: proporciones `4fr 1fr 3fr 4fr`.
  - Joystick izquierdo (4).
  - SELECT/START (1).
  - Joystick derecho (3).
  - ABXY (4).

#### Controles

- Usa eventos `pointerdown`/`pointerup`/`pointermove`/`pointercancel`.
- `touch-action: manipulation` para evitar doble-tap zoom.
- Joysticks con deadzone del 5% (`DEADZONE = 0.05`).
- ABXY: área única dividida por ángulos con soporte multitouch.
- SELECT/START: iconos SVG.

#### Feedback

- Visual: clase `.active` al pulsar.
- Háptico: `navigator.vibrate(8)` (no funciona en iOS Safari).
- Sonoro: Web Audio API con osciladores `triangle`/`square`, estilo "tac-tac".

#### Conexión

- WebSocket a `ws://${location.host}/ws`.
- Reconexión automática cada 1 segundo si se cierra la conexión.
- Indicador de estado flotante (`#status`).

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

- **Inline todo en `index.html`**: se simplifica el despliegue. No hay bundler ni assets externos.
- **`Bun.file()` para servir HTML**: el servidor lee `index.html` desde disco.
- **No hay base de datos ni persistencia**: todo es estado en memoria.
- **mDNS con fallback**: se anuncia `mando.local` para facilitar la conexión. Si falta Bonjour, se usa IP local.
- **`vigemclient` con `require()`**: aunque el proyecto es ESM, el addon nativo requiere `require()`.
- **TailwindCSS v4 via PostCSS**: no se usa el CLI de Tailwind ni Vite. `@source` con rutas absolutas porque las relativas fallan en Windows+Bun.

## Puntos de fricción conocidos

- ViGEmBus requiere instalación con privilegios de administrador.
- `mando.local` puede no resolverse si Windows no tiene un resolvedor mDNS instalado. (Manejado con fallback.)
- `vigemclient` tiene un addon nativo; `bun build --compile` embebe el `.node` y la DLL.
- El altavoz del iPhone no reproduce bien frecuencias muy graves; el sonido se ha ajustado a "tac-tac" seco.
- Los antivirus pueden detectar falsos positivos por: binario sin firmar, driver kernel embebido, y modificación del subsistema PE.
