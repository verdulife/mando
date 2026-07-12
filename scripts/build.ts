import { $ } from 'bun'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname!, '..')
const DIST_DIR = path.join(ROOT, 'dist')
const ASSETS_DIR = path.join(ROOT, 'assets')
const VIGEM_DIR = path.join(ROOT, 'node_modules', 'vigemclient', 'build', 'Release')
const VIGEM_BUS_URL = 'https://github.com/nefarius/ViGEmBus/releases/download/v1.22.0/ViGEmBus_1.22.0_x64_x86_arm64.exe'
const VIGEM_BUS_EXE = 'ViGEmBus_1.22.0_x64_x86_arm64.exe'
const RCEDIT_URL = 'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe'
const RCEDIT_EXE = path.join(ROOT, 'tools', 'rcedit-x64.exe')
const ICON_PATH = path.join(ROOT, 'src', 'public', 'icons', 'icon.ico')

function step(name: string) {
  console.log(`\n[build] ${name}`)
}

async function downloadFile(url: string, dest: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`)
  }
  await Bun.write(dest, res)
}

async function main() {
  mkdirSync(DIST_DIR, { recursive: true })

  step('Running postinstall checks')
  const dllBin = path.join(VIGEM_DIR, 'ViGEmClient.dll.bin')
  const publicEmbedded = path.join(ROOT, 'src', 'public-embedded.ts')
  if (!existsSync(dllBin) || !existsSync(publicEmbedded)) {
    await $`bun run scripts/postinstall.ts`
  } else {
    // Regenerate CSS so the latest Tailwind classes are included
    await $`bun run build:css`
    await $`bun run ${path.join(ROOT, 'scripts', 'generate-public-embedded.ts')}`
  }

  step('Downloading ViGEmBus installer')
  const installerPath = path.join(DIST_DIR, VIGEM_BUS_EXE)
  if (!existsSync(installerPath)) {
    await downloadFile(VIGEM_BUS_URL, installerPath)
    console.log('  Downloaded:', installerPath)
  } else {
    console.log('  Already present:', installerPath)
  }

  // Copy to assets/ for embedding in compiled exe
  const assetInstallerPath = path.join(ASSETS_DIR, `${VIGEM_BUS_EXE}.bin`)
  mkdirSync(ASSETS_DIR, { recursive: true })
  if (!existsSync(assetInstallerPath)) {
    await Bun.write(assetInstallerPath, Bun.file(installerPath))
    console.log('  Copied to:', assetInstallerPath)
  }

  step('Compiling standalone executable')
  const exePath = path.join(DIST_DIR, 'mando.exe')
  await $`bun build --compile --windows-hide-console src/server.ts --outfile ${exePath}`

  step('Hiding console window')
  await $`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\hide-console.ps1 -Path ${exePath}`

  step('Downloading rcedit')
  if (!existsSync(RCEDIT_EXE)) {
    mkdirSync(path.dirname(RCEDIT_EXE), { recursive: true })
    await downloadFile(RCEDIT_URL, RCEDIT_EXE)
    console.log('  Downloaded:', RCEDIT_EXE)
  } else {
    console.log('  Already present:', RCEDIT_EXE)
  }

  step('Setting executable icon and metadata')
  await $`${RCEDIT_EXE} ${exePath} --set-icon ${ICON_PATH} --set-version-string "FileDescription" "Mando" --set-version-string "ProductName" "Mando" --set-version-string "OriginalFilename" "mando.exe" --set-version-string "InternalName" "mando" --set-version-string "CompanyName" "Mando" --set-version-string "LegalCopyright" "Copyright (c) 2026 Mando" --set-file-version "0.1.0" --set-product-version "0.1.0"`

  step('Smoke test')
  const proc = Bun.spawn([exePath], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, MANDO_DEBUG: '1', MANDO_SKIP_VIGEM_INSTALL: '1' }
  })

  try {
    const timeout = 5000
    const start = Date.now()
    let ok = false
    let lastError = ''

    while (Date.now() - start < timeout) {
      await Bun.sleep(100)
      try {
        const res = await fetch('http://127.0.0.1:7355/api/status')
        if (res.ok) {
          const body = await res.json()
          console.log('  Status:', JSON.stringify(body))
          ok = body.status === 'ok'
          break
        }
      } catch (e) {
        lastError = String(e)
      }
    }

    if (!ok) {
      const stderr = await new Response(proc.stderr).text()
      throw new Error(`Smoke test failed: ${lastError}\n${stderr}`)
    }
  } finally {
    proc.kill()
    await proc.exited
  }

  console.log(`\n[build] OK → ${exePath}`)
}

main().catch(err => {
  console.error('[build] FAILED:', err)
  process.exit(1)
})
