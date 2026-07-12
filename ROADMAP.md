# ROADMAP.md — Mando

Plan de implementación acordado. Resolver fase a fase en orden.

> **Nota:** A partir de julio 2026, la distribución se hace mediante un único
> `mando.exe` autocontenido que auto-instala ViGEmBus en primera ejecución.
> Los enfoques anteriores (Inno Setup → Fase 5, script PowerShell → Fase 13)
> quedan superseded / en banquillo.

---

## Fase 1 — PWA y experiencia nativa en el iPhone

Objetivo: que al añadir la webapp a la pantalla de inicio del iPhone se comporte como una app nativa.

### Tareas

- [x] Crear `src/public/manifest.json`:
  - `name`: Mando
  - `short_name`: Mando
  - `display`: `fullscreen`
  - `start_url`: `/`
  - `theme_color` y `background_color`
  - `icons`: 192x192, 512x512
- [x] Crear iconos PNG en `src/public/icons/`.
- [x] Crear `src/public/sw.js` con cacheo básico para funcionar offline.
- [x] Registrar el service worker en `index.html`.
- [x] Añadir en `index.html`:
  - `<link rel="manifest" href="/manifest.json">`
  - `<meta name="theme-color">`
  - `<link rel="apple-touch-icon">`
- [x] Servir `manifest.json`, `sw.js` e iconos desde `src/server.ts`.
- [x] Asegurar orientación landscape en iPhone.

---

## Fase 2 — Soporte multi-mando (un mando virtual por dispositivo)

Objetivo: cada dispositivo conectado genere su propio mando Xbox 360 virtual en Windows.

### Tareas

> - [x] Refactorizar `src/gamepad.ts`:
>   - Permitir crear múltiples `X360Controller`.
>   - Asignar un `playerId` a cada target.
>   - Liberar el target ViGEm al desconectar.
> - [x] Actualizar `src/server.ts`:
>   - Cada cliente WS recibe su propio controller.
>   - Liberar solo el controller del cliente que se desconecta.
> - [x] Verificar que aparecen múltiples mandos Xbox 360 (prueba con 2+ clientes WS).
> - [ ] Probar con 2+ iPhones reales simultáneamente.

---

## Fase 3 — Panel de administración web

Objetivo: página web local para gestionar conexiones, ver URLs y escanear QR.

### Tareas

- [x] Crear `src/public/admin.html` con:
  - URLs de acceso (localhost, IP local, mDNS).
  - Código QR para conectar desde iPhone.
  - Lista de dispositivos conectados con player asignado.
  - Botón para expulsar un dispositivo.
- [x] Crear endpoints API en `src/server.ts`:
  - `GET /admin` sirve `admin.html`.
  - `GET /api/status` devuelve estado del servidor.
  - `GET /api/clients` devuelve lista de clientes.
  - `POST /api/clients/:id/kick` expulsa un cliente.
- [x] Integrar librería QR (`qrcode` en backend, `/api/qr` devuelve SVG).
- [ ] Asegurar que `admin.html` no es accesible desde fuera de `localhost` o la red local (opcional).

---

## Fase 4 — Tray icon e inicio automático

Objetivo: ejecutar el servidor en segundo plano con icono en la bandeja del sistema.

### Tareas

> - [x] Añadir `systray2` a `package.json`.
> - [x] Crear `src/tray.ts` con:
>   - Inicialización del icono de bandeja.
>   - Menú: Abrir panel de admin, Iniciar con Windows, Salir.
> - [x] Importar e iniciar el tray en `src/server.ts`.
> - [x] Guardar configuración en `%APPDATA%\Mando\config.json`:
>   - `autoStart: boolean`
> - [x] Implementar inicio automático mediante clave `Run` del registro de Windows.
> - [x] Compilar con `bun build --compile --windows-hide-console`.
> - [x] Resolver carga de `vigemclient.node` + `ViGEmClient.dll` en ejecutable compilado.
> - [x] Probar que al ejecutar el `.exe` no aparece consola y el tray funciona.

---

## Fase 5 — Instalador para Windows (superseded)

> **SUPERSEDED** por el enfoque actual: un solo `mando.exe` autocontenido
> que auto-instala ViGEmBus. No necesita instalador.

Objetivo: un único `.exe` de instalación que instale todo lo necesario.

### Tareas

- [x] Crear script `scripts/build.ts` para:
  - Compilar `mando.exe` con `bun build --compile`.
  - Generar iconos.
  - Generar wrappers embebidos de `vigemclient`.
  - Descargar instalador de ViGEmBus.
  - Ejecutar smoke test.
- [x] Crear icono `.ico` en `src/public/icons/icon.ico`.
- [x] Crear script de Inno Setup (`scripts/setup.iss`):
  - Copiar `mando.exe` a `{autopf}\Mando\`.
  - Detectar e instalar silenciosamente ViGEmBus si falta.
  - Crear accesos directos en menú inicio y escritorio.
  - Configurar inicio automático.
  - Crear desinstalador.
- [x] Descargar/embeber `ViGEmBus_1.22.0_x64_x86_arm64.exe` en el instalador.
- [x] Generar el instalador final `dist/MandoSetup.exe`.

---

## Fase 6 — TailwindCSS v4

Objetivo: migrar estilos inline a TailwindCSS v4 con arbitrary classes para flexibilidad total en el layout.

### Tareas

- [x] Instalar TailwindCSS v4.3.2 + `@tailwindcss/postcss`.
- [x] Crear `src/public/styles-input.css` con `@import "tailwindcss"`, `@theme`, `@layer base/components`.
- [x] Crear `scripts/build-css.ts` con PostCSS API.
- [x] Integrar build:css en `postinstall.ts` y `build.ts`.
- [x] Migrar estilos inline de `index.html` y `admin.html` a Tailwind classes.
- [x] Fix caracteres corruptos (tildes) en ambos HTML.
- [x] Resolver arbitrary classes: `@source` con rutas absolutas (las relativas fallan en Windows+Bun).
- [x] Reemplazar helper CSS classes por clases Tailwind arbitrarias.
- [x] Eliminar helpers de `styles-input.css` y paquetes innecesarios.

---

## Fase 7 — Testing y documentación final

Objetivo: validar el producto end-to-end y actualizar documentación.

### Tareas

- [x] Probar instalador limpio en Windows 10/11 sin ViGEmBus.
- [x] Verificar que `mando.local` funciona tras instalar Bonjour.
- [x] Probar 2+ iPhones → 2+ mandos en `joy.cpl`.
- [x] Probar tray icon, inicio automático y desinstalador.
- [x] Actualizar `README.md` para usuarios finales.
- [x] Actualizar `AGENTS.md`, `ARCHITECTURE.md` y `ROADMAP.md` si hay cambios.

---

## Fase 8 — Componentización UI

Objetivo: crear Web Components reutilizables para botones, joysticks, ABXY, etc. con grid engine flexible y efectos visuales al presionar.

### Tareas

- [x] Crear Web Components: `<mando-button>`, `<mando-joystick>`, `<mando-pad>` (ABXY/dpad), `<grid-engine>`, `<mando-gamepad>` (orquestador).
- [x] Crear grid engine declarativo (configurable por JSON: filas, columnas, width, height para cada celda).
- [x] Refactorizar `index.html` para usar componentes + grid engine.
- [x] Efectos visuales: radial glow (250px, blur 44px) que sigue al dedo + neón interior fino (border 0.5px, rgba(30,130,255,0.2)) al presionar.
- [x] Multitouch en pad: glow pool de 4 radiales para 4 dedos simultáneos.

---

## Fase 9 — Layouts múltiples

Objetivo: soportar diferentes layouts de controlador (Xbox, NES, Switch, etc.).

### Tareas

- [x] Sistema de layouts modulares (areas + components + grid-engine.js).
- [x] Layouts creados: Xbox, GameBoy (D-Pad/Joystick), Arcade (D-Pad/Joystick, ABC), Fighter (D-Pad/Joystick, ABXY), Racing, Shooter.

---

## Fase 10 — Selector de layout en admin

Objetivo: permitir al usuario elegir layout desde el panel de administración.

### Tareas

- [x] Selector de layout en admin.html por cliente.
- [x] API GET /api/layouts, settings POST acepta layout.
- [x] Persistencia: layout por cliente + default global en config.json.
- [x] Cliente aplica layout dinámicamente con setLayout(id).

---

## Fase 11 — Personalizar instalador (superseded)

Objetivo: personalizar assets del instalador (iconos, splash screen, etc.).

> **SUPERSEDED** por el enfoque actual (single exe autocontenido).

### Tareas

- [ ] ~~El usuario crea iconos personalizados.~~
- [ ] ~~Actualizar `scripts/setup.iss` con nuevos assets.~~
- [ ] ~~Regenerar `MandoSetup.exe`.~~

---

## Fase 12 — Editor de layouts visual

Objetivo: permitir crear y editar layouts desde el panel de administración.

### Tareas

- [x] API endpoints: `GET /api/layouts`, `POST /api/layouts`, `DELETE /api/layouts/:id`.
- [x] Directorio de layouts de usuario en `%APPDATA%/Mando/layouts/`.
- [x] Modal visual con toolbar de códigos, grid WYSIWYG y preview de componentes.
- [x] Drag & drop desde toolbar al grid.
- [x] Click para seleccionar área y cambiar código desde toolbar.
- [x] Redimensionado en 4 direcciones con handles y detección de solapamiento.
- [x] Rejilla visible con líneas finas y código de texto en áreas inválidas.
- [x] Arrastrar y reposicionar áreas existentes.
- [x] Importar y exportar layouts JSON.
- [x] Prevención de códigos duplicados en el grid.
- [x] Guardar y refrescar lista de layouts en admin.
- [ ] Testear: arrastrar, reposicionar, redimensionar, import/export, guardar, cerrar y reabrir.

---

## Notas

- Las fases deben resolverse en orden, pero dentro de cada fase se puede iterar.
- Antes de la Fase 5 se recomienda una prueba de concepto del multi-mando (Fase 2) para asegurar que ViGEm soporta múltiples targets.
- A partir de julio 2026 la distribución es mediante un solo `mando.exe` que auto-instala ViGEmBus.

---

## Fase 13 — Instalador script (PowerShell TUI) [BANQUILLO]

Objetivo: reemplazar el ejecutable compilado + Inno Setup por un script PowerShell
con interfaz TUI atractiva, evitando falsos positivos de antivirus.

> **ESTADO: BANQUILLO.** El `.bat` de extracción tiene un bug que crea un archivo
> `$null`. El enfoque actual (single exe + auto-install) hace este instalador
> innecesario, pero se mantiene como alternativa.

### Tareas

- [x] `scripts/install.bat` (único archivo, doble-click):
  - El batch header extrae el script PowerShell embebido
  - Detecta PowerShell 7+ y guía al usuario si falta
- [x] `scripts/install.ps1` (fuente PowerShell):
  - Logo ASCII con bordes y color brand (`#edca48`)
  - Navegación horizontal con ← → + Enter (sin teclas complejas)
  - Preaviso amable antes de cada acción del sistema
  - Paso 1: Verificar Windows 10/11 x64
  - Paso 2: Instalar Bun (descarga desde bun.sh)
  - Paso 3: Instalar ViGEmBus (descarga + ejecución del installer)
  - Paso 4: Descargar/instalar Mando en `%APPDATA%\Mando`
  - Paso 5: Configurar inicio automático (scheduled task, sin ventana)
  - Resumen final con checkmarks + enlace al admin panel
- [x] `scripts/run.ps1`: Launcher invisible para scheduled task
- [x] `scripts/uninstall.ps1`: Limpieza de tarea, registro y carpeta
- [x] Probar sintaxis, extracción y renderizado del instalador
- [ ] ~~Probar todo el flujo de instalación real (descarga e instalación)~~
- [ ] ~~Manejar edge cases (Bun ya instalado, ViGEmBus ya instalado, sin permisos de admin, etc.)~~
- [ ] ~~Probar desinstalación~~
