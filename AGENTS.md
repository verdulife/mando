# AGENTS.md — Mando

## Qué es este proyecto

**Mando** convierte uno o varios iPhones (u otros dispositivos con navegador) en mandos Xbox 360 virtuales para Windows.

- El PC ejecuta un servidor Bun en Windows.
- El servidor crea mandos virtuales mediante ViGEmBus.
- Cada dispositivo se conecta por WiFi a una webapp táctil.
- Cada dispositivo conectado controla su propio mando virtual en Windows.

## Stack tecnológico

- **Runtime:** Bun (Windows x64).
- **Lenguaje:** TypeScript.
- **Servidor:** `Bun.serve` (HTTP + WebSocket).
- **Descubrimiento de red:** `bonjour-service` (mDNS/Bonjour), hostname `mando.local`.
- **Mandos virtuales:** `vigemclient` + driver ViGEmBus.
- **Frontend:** Web Components nativos (custom elements), HTML/CSS/JS modular.
- **CSS:** TailwindCSS v4.3.2 + `@tailwindcss/postcss`.
- **Plataforma objetivo:** Windows 10/11 x64.

## Cómo ejecutar en desarrollo

```powershell
bun install
bun run dev
```

Por defecto usa el puerto `7355`. Se puede cambiar con:

```powershell
$env:PORT=8080; bun run dev
```

## Cómo instalar para el usuario final

```powershell
# Doble click en scripts\install.bat, o desde terminal:
.\scripts\install.bat
```

El instalador guía al usuario con una interfaz TUI atractiva:
flechas ← → para navegar, Enter para aceptar. Sin teclas complejas.

## Cómo generar el instalador

```powershell
bun install
bun run build
bun run build:installer
```

El instalador final se genera en `dist/MandoSetup.exe`.

## Requisitos del sistema

1. Windows 10/11 x64.
2. Bun instalado (solo en desarrollo).
3. Driver ViGEmBus instalado (el instalador final lo instalará automáticamente).
4. Resolvedor mDNS/Bonjour en Windows para que `mando.local` funcione (iTunes, iCloud o Bonjour Print Services).

## Estructura de archivos

```
mando/
├── src/
│   ├── server.ts          # Servidor HTTP/WebSocket/mDNS
│   ├── gamepad.ts         # Wrapper ViGEmClient (mando virtual)
│   ├── vigem-loader.ts    # Carga del addon nativo embebido
│   ├── vigem-embedded.ts  # Wrappers JS de vigemclient para el exe
│   ├── public-loader.ts   # Carga/extracción de archivos públicos embebidos
│   ├── public-embedded.ts # Archivos públicos embebidos en base64
│   ├── tray.ts            # Tray icon e inicio automático
│   └── public/
│       ├── layouts/
│       │   ├── diccionario.js    # Códigos y defaults de componentes
│       │   ├── default.json      # Xbox (JSON, se carga vía fetch)
│       │   ├── gameboy-dpad.json
│       │   ├── gameboy-joystick.json
│       │   ├── arcade-dpad.json
│       │   ├── arcade-joystick.json
│       │   ├── fighter-dpad.json
│       │   ├── fighter-joystick.json
│       │   ├── racing.json
│       │   └── shooter.json
│       ├── components/
│       │   ├── mando-button.js
│       │   ├── mando-joystick.js
│       │   ├── mando-pad.js
│       │   ├── grid-engine.js
│       │   └── mando-gamepad.js
│       ├── index.html     # Webapp táctil del mando
│       ├── admin.html     # Panel de administración
│       ├── styles-input.css  # Fuente de estilos Tailwind v4
│       ├── styles.css        # CSS generado por PostCSS
│       ├── manifest.json  # PWA manifest
│       ├── sw.js          # Service worker
│       └── icons/         # Iconos PNG/ICO
├── scripts/
│   ├── install.bat               # [NUEVO] Instalador (doble click) — un solo archivo
│   ├── install.ps1               # [NUEVO] Fuente PowerShell del instalador
│   ├── run.ps1                   # [NUEVO] Launcher invisible para inicio automático
│   ├── uninstall.ps1             # [NUEVO] Desinstalador
│   ├── build.ts                  # Build de mando.exe + descarga de ViGEmBus (legacy)
│   ├── build-debug.ts            # Build de mando-debug.exe (legacy)
│   ├── build-css.ts              # Build de CSS con PostCSS + Tailwind v4
│   ├── postinstall.ts            # Genera iconos, CSS, wrappers embebidos
│   ├── setup.iss                 # Script de Inno Setup (legacy)
│   ├── hide-console.ps1          # Post-proceso: cambia subsistema a WINDOWS (legacy)
│   ├── generate-icons.py         # Generación de iconos
│   ├── generate-vigem-embedded.ts  # Genera vigem-embedded.ts (legacy)
│   └── generate-public-embedded.ts # Genera public-embedded.ts (legacy)
├── ROADMAP.md            # Plan de implementación por fases
├── test-vigem.ts          # Script de diagnóstico de ViGEm
├── package.json
├── bun.lock
└── README.md
```

## Decisiones de diseño ya tomadas

- ~~**Un solo ejecutable final:** se compilará con `bun build --compile`.~~
- **Distribución mediante script PowerShell:** para evitar falsos positivos de antivirus.
  El instalador (`install.ps1`) descarga Bun, ViGEmBus y Mando en el sistema del usuario.
- ~~**Sin consola en producción:** `--windows-hide-console`.~~
- **Tray icon en Windows:** `systray2` para abrir panel admin y salir.
- **Panel de administración:** página web local (`/admin`) servida por Bun, no GUI nativa.
- **Multi-dispositivo:** cada cliente crea su propio `X360Controller`. No hay mando compartido.
- **Sonidos:** feedback tipo "tac-tac" generado con Web Audio API (triangle + square corto).
- **Inicio automático:** activado por defecto, desactivable desde tray/GUI.

## Estado actual

- [x] Servidor HTTP + WebSocket.
- [x] mDNS/Bonjour (`mando.local`) con fallback a IP local si no hay Bonjour.
- [x] Webapp táctil con joysticks, ABXY, shoulders, triggers, SELECT/START.
- [x] Integración ViGEm: múltiples mandos virtuales Xbox 360 (uno por dispositivo).
- [x] Reconexión automática en el cliente.
- [x] Liberación de botones/ejes al desconectar.
- [x] Feedback sonoro.
- [x] PWA/manifest/service worker.
- [x] Soporte multi-mando probado (2+ dispositivos simultáneos).
- [x] Panel de administración web con QR, lista de clientes y ajustes por dispositivo.
- [x] Tray icon e inicio automático probados.
- [x] Instalador Windows probado en PC limpio.
- [x] Instalador script PowerShell con TUI (flechas ← →, Enter, colores brand).
- [x] TailwindCSS v4 con arbitrary classes funcionales.
- [x] Bonjour fallback: el servidor no crashea si falta el resolvedor mDNS.
- [x] Componentización UI (Web Components: mando-button, mando-joystick, mando-pad, grid-engine, mando-gamepad).
- [x] Efectos visuales: radial glow + neón interior fino al presionar.
- [x] Layouts modulares: grid-engine construye DOM desde areas + components.
- [x] Layouts disponibles: Xbox, GameBoy (D-Pad/Joystick), Arcade (D-Pad/Joystick, ABC 3 sectores), Fighter (D-Pad/Joystick, ABXY), Racing, Shooter.
- [x] ABX pad: 3 sectores pizza-slice (120°) A/B/X, rotado centrando A abajo.
- [x] letterPos(): posiciones de letras calculadas vectorialmente.
- [x] Sistema de layouts JSON con carga dinámica vía fetch.
- [x] Layout builder visual (drag & drop, click, redimensionado 4 direcciones, import/export, guardar/editar).
- [ ] Testear editor de layouts visual (arrastrar, reposicionar, redimensionar, import/export, guardar, cerrar y reabrir).

## Convenciones

- Usa TypeScript con ESM (`"type": "module"`).
- `vigemclient` se importa con `require()` porque es CommonJS con addon nativo.
- Los logs del servidor usan formato `[HH:MM:SS] mensaje` en español.
- El puerto por defecto es `7355`.
- El hostname mDNS es `mando` → `mando.local`.
- La webapp del mando se sirve en `/`; el panel admin irá en `/admin`.
- CSS build: `bun run build:css` ejecuta `scripts/build-css.ts` que usa PostCSS + `@tailwindcss/postcss`.
- `@source` en `styles-input.css` usa rutas absolutas (`C:/Users/verdu/mando/src/public/**/*.html`) porque las rutas relativas no funcionan en Windows+Bun.

## Notas importantes

- `vigemclient` contiene un addon nativo N-API y depende de `ViGEmClient.dll`. El build embebe ambos archivos y reconstruye el paquete `vigemclient` en `%TEMP%\mando-vigem` en tiempo de ejecución para que Windows resuelva la DLL correctamente. (Solo relevante para el build compilado legacy.)
- Los archivos públicos (`src/public/`) se embeben en base64 en `src/public-embedded.ts` y se extraen a `%TEMP%\mando-public` en el ejecutable compilado. (Solo relevante para el build compilado legacy.)
- `bun build --compile --windows-hide-console` tiene un bug conocido en Bun que no oculta la consola. El build post-procesa `mando.exe` con `scripts/hide-console.ps1` para cambiar el subsistema PE de CONSOLE a WINDOWS.
- ViGEmBus está archivado en GitHub pero la última versión (`1.22.0`) sigue funcionando en Windows 10/11.
- El driver requiere privilegios de administrador para instalarse.
- mDNS puede fallar en Windows si no hay un resolvedor Bonjour instalado. El servidor maneja este caso con un try-catch y continúa funcionando usando la IP local.
- El instalador script (`install.ps1`) requiere PowerShell 7+. El script verifica la versión al inicio y guía al usuario si es necesario.
- El instalador se auto-eleva a administrador cuando necesita instalar ViGEmBus.
- El inicio automático se implementa como tarea programada (scheduled task) en vez de registro HKCU\Run, para ocultar la ventana de terminal.
