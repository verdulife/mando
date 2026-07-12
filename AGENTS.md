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
- **CI/CD:** GitHub Actions (compila `mando.exe` en cada release tag).

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

Descargar `mando.exe` de GitHub Releases y ejecutarlo. En primera ejecución instala ViGEmBus automáticamente si falta.

## Cómo compilar el ejecutable

```powershell
bun install
bun run build
```

Genera `dist/mando.exe` con todo embebido (webapp, ViGEmClient.dll, ViGEmBus installer).

## Cómo lanzar un release

```powershell
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions compila y publica el Release automáticamente.

## Requisitos del sistema

1. Windows 10/11 x64.
2. Driver ViGEmBus (se instala automáticamente en primera ejecución).
3. Resolvedor mDNS/Bonjour en Windows para que `mando.local` funcione (iTunes, iCloud o Bonjour Print Services).

## Estructura de archivos

```
mando/
├── .github/workflows/
│   └── release.yml       # GitHub Actions: compila y publica releases
├── src/
│   ├── server.ts          # Servidor HTTP/WebSocket/mDNS
│   ├── gamepad.ts         # Wrapper ViGEmClient (mando virtual)
│   ├── vigem-loader.ts    # Carga del addon nativo embebido
│   ├── vigem-embedded.ts  # Wrappers JS de vigemclient para el exe
│   ├── vigem-installer.ts # Auto-instalación de ViGEmBus
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
│   ├── build.ts                  # Build de mando.exe (principal)
│   ├── build-debug.ts            # Build de mando-debug.exe
│   ├── build-css.ts              # Build de CSS con PostCSS + Tailwind v4
│   ├── postinstall.ts            # Genera iconos, CSS, wrappers embebidos
│   ├── hide-console.ps1          # Post-proceso: cambia subsistema a WINDOWS
│   ├── generate-icons.py         # Generación de iconos
│   ├── generate-vigem-embedded.ts  # Genera vigem-embedded.ts
│   ├── generate-public-embedded.ts # Genera public-embedded.ts
│   ├── setup.iss                 # Script de Inno Setup (legacy)
│   ├── install.bat               # [BANQUILLO] Instalador TUI PowerShell
│   ├── install.ps1               # [BANQUILLO] Fuente del instalador TUI
│   ├── run.ps1                   # [BANQUILLO] Launcher invisible
│   └── uninstall.ps1             # [BANQUILLO] Desinstalador
├── assets/
│   ├── icon.svg                  # Icono fuente
│   └── ViGEmBus_*.exe.bin        # Installer de ViGEmBus (embebido en build)
├── AGENTS.md
├── ARCHITECTURE.md
├── README.md
├── ROADMAP.md
├── package.json
├── bun.lock
└── test-vigem.ts
```

## Decisiones de diseño ya tomadas

- **Un solo ejecutable autocontenido:** `mando.exe` incluye webapp, ViGEmClient.dll, vigemclient.node y el instalador de ViGEmBus. No necesita instalación ni dependencias externas.
- **Auto-instalación de ViGEmBus:** si el driver no está instalado, `mando.exe` lo extrae del propio ejecutable y lo instala silenciosamente en primera ejecución (con re-lanzamiento como admin si es necesario).
- **Distribución vía GitHub Releases:** cada tag `v*` dispara GitHub Actions que compila y publica el `.exe`.
- **Sin consola en producción:** `--windows-hide-console` + post-procesado con `hide-console.ps1`.
- **Tray icon en Windows:** `systray2` para abrir panel admin y salir.
- **Panel de administración:** página web local (`/admin`) servida por Bun, no GUI nativa.
- **Multi-dispositivo:** cada cliente crea su propio `X360Controller`. No hay mando compartido.
- **Sonidos:** feedback tipo "tac-tac" generado con Web Audio API (triangle + square corto).
- **Inicio automático:** activado por defecto, desactivable desde tray/GUI.
- **Instalador script PowerShell (BANQUILLO):** `install.ps1` con TUI funciona pero el `.bat` de extracción tiene un bug. Se mantiene como alternativa pero no se usa activamente.

## Estado actual

### Implementado y probado

- [x] Servidor HTTP + WebSocket.
- [x] mDNS/Bonjour (`mando.local`) con fallback a IP local si no hay Bonjour.
- [x] Webapp táctil con joysticks, ABXY, shoulders, triggers, SELECT/START.
- [x] Integración ViGEm: múltiples mandos virtuales Xbox 360 (uno por dispositivo).
- [x] Reconexión automática en el cliente.
- [x] Liberación de botones/ejes al desconectar.
- [x] Feedback sonoro y visual (radial glow + neón).
- [x] PWA/manifest/service worker.
- [x] Soporte multi-mando probado (2+ dispositivos simultáneos).
- [x] Panel de administración web con QR, lista de clientes y ajustes por dispositivo.
- [x] Selector de layout por cliente desde admin.
- [x] Persistencia de configuración (layout, sonido, vibración).
- [x] Tray icon e inicio automático.
- [x] TailwindCSS v4 con arbitrary classes.
- [x] Componentización UI (Web Components).
- [x] Layouts modulares (Xbox, GameBoy, Arcade, Fighter, Racing, Shooter).
- [x] Editor de layouts visual (drag & drop, redimensionado, import/export).
- [x] Auto-instalación de ViGEmBus desde el propio ejecutable.
- [x] GitHub Actions release workflow.

### Por hacer / en banquillo

- [ ] Testear editor de layouts visual a fondo (arrastrar, reposicionar, redimensionar, import/export, guardar, cerrar y reabrir).
- [ ] Instalador script PowerShell (`install.ps1` + `install.bat`) — **en banquillo** por bug de extracción del `.bat`. El enfoque actual (single exe + auto-install) lo hace innecesario.

## Convenciones

- Usa TypeScript con ESM (`"type": "module"`).
- `vigemclient` se importa con `require()` porque es CommonJS con addon nativo.
- Los logs del servidor usan formato `[HH:MM:SS] mensaje` en español.
- El puerto por defecto es `7355`.
- El hostname mDNS es `mando` → `mando.local`.
- CSS build: `bun run build:css` ejecuta `scripts/build-css.ts` que usa PostCSS + `@tailwindcss/postcss`.
- `@source` en `styles-input.css` usa rutas absolutas (`C:/Users/verdu/mando/src/public/**/*.html`) porque las rutas relativas no funcionan en Windows+Bun.
- Los releases se gestionan con tags Git + GitHub Actions.

## Notas importantes

- `vigemclient` contiene un addon nativo N-API y depende de `ViGEmClient.dll`. El build embebe ambos archivos y reconstruye el paquete `vigemclient` en `%TEMP%\mando-vigem\PID` en tiempo de ejecución.
- Los archivos públicos (`src/public/`) se embeben en base64 en `src/public-embedded.ts` y se extraen a `%TEMP%\mando-public` en el ejecutable compilado.
- El instalador de ViGEmBus se importa con `import ... with { type: 'file' }` y se extrae a `%TEMP%\mando-vigembus-installer.exe` en primera ejecución si el driver falta.
- `bun build --compile --windows-hide-console` tiene un bug conocido que no oculta la consola. Se post-procesa con `hide-console.ps1`.
- ViGEmBus `1.22.0` (última versión disponible) funciona en Windows 10/11.
- El driver requiere privilegios de administrador para instalarse.
- mDNS puede fallar en Windows si no hay un resolvedor Bonjour instalado. El servidor maneja este caso y continúa usando la IP local.
- `Bun.embeddedFiles` no incluye archivos importados con `with { type: 'file' }`. Estos se acceden directamente vía `Bun.file(path)`.
