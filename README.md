# Mando

Convierte uno o varios iPhones (u otros dispositivos con navegador) en mandos Xbox 360 virtuales para Windows.

- El PC ejecuta un servidor Bun en segundo plano.
- Crea un mando virtual por dispositivo conectado mediante ViGEmBus.
- Cada dispositivo se conecta por WiFi a una webapp táctil.
- Los mandos se detectan en Windows como controladores Xbox 360 reales (aparecen en `joy.cpl`).

## Características

- Webapp táctil con joysticks, ABXY, shoulders, triggers, SELECT/START.
- Soporte multi-mando: cada dispositivo tiene su propio mando virtual.
- Panel de administración web en `/admin` con QR para conectar rápido.
- Descubrimiento mDNS (`mando.local`) — si no hay Bonjour, se conecta por IP local.
- Feedback sonoro (Web Audio API) y visual (radial glow + neón interior) al pulsar botones.
- PWA: se puede añadir a la pantalla de inicio del iPhone.
- Tray icon en la bandeja de Windows con inicio automático opcional.
- Sonido y vibración configurables por dispositivo desde el panel admin.

## Instalación

Descarga `MandoSetup.exe` desde la sección de releases y ejecútalo como administrador. El instalador:

1. Copia el servidor a `C:\Program Files\Mando\`.
2. Instala el driver ViGEmBus si no está presente.
3. Pregunta si quieres que Mando inicie con Windows.
4. Al finalizar, abre el panel de administración en el navegador.

### Requisitos

- Windows 10/11 x64.
- Opcional: resolvedor mDNS/Bonjour (iTunes, iCloud o Bonjour Print Services) para usar `mando.local`.
- Opcional: conexión WiFi para conectar dispositivos.

## Cómo usar

1. Conecta el PC y los dispositivos a la misma red WiFi.
2. El panel de admin se abre automáticamente al iniciar Mando (o haz clic en el icono de la bandeja).
3. Escanea el código QR o escribe la URL en el navegador del dispositivo.
4. Usa los controles táctiles.
5. Para verificar: abre `joy.cpl` (Win + R → `joy.cpl`) — aparecerá un controlador Xbox 360 por cada dispositivo conectado.

También puedes abrir la webapp directamente desde el PC en `http://localhost:7355`.

## Desarrollo

```powershell
bun install
bun run dev
```

Por defecto escucha en el puerto `7355`. Puedes cambiarlo con:

```powershell
$env:PORT=8080; bun run dev
```

### Generar el instalador

Requisitos adicionales:

- Python 3 con Pillow (se creará automáticamente un venv en `.venv`).
- Inno Setup 6/7 (el comando `iscc` debe estar en PATH).

```powershell
bun run build
bun run build:installer
```

El instalador final se genera en `dist/MandoSetup.exe`.

## Notas

- **Firewall:** la primera vez que lo ejecutes, Windows puede pedir permisos de red. Acepta.
- **mDNS:** si `mando.local` no funciona, usa la IP local que muestra el panel de administración.
- **ViGEmBus:** el driver debe estar instalado. El instalador lo instala automáticamente. En desarrollo: `winget install -e --id ViGEm.ViGEmBus`.
