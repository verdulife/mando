import { $ } from 'bun'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname!, '..')
const DIST_DIR = path.join(ROOT, 'dist')
const VIGEM_DIR = path.join(ROOT, 'node_modules', 'vigemclient', 'build', 'Release')
const VIGEM_BUS_URL = 'https://github.com/nefarius/ViGEmBus/releases/download/v1.22.0/ViGEmBus_1.22.0_x64_x86_arm64.exe'
const VIGEM_BUS_EXE = 'ViGEmBus_1.22.0_x64_x86_arm64.exe'
const RCEDIT_URL = 'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe'
const RCEDIT_EXE = path.join(ROOT, 'tools', 'rcedit-x64.exe')
const ICON_PATH = path.join(ROOT, 'src', 'public', 'icons', 'icon.ico')

function step(name: string) {
  console.log(`\n[build:debug] ${name}`)
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

  step('Compiling standalone executable (debug mode — console visible)')
  const exePath = path.join(DIST_DIR, 'mando-debug.exe')
  await $`bun build --compile src/server.ts --outfile ${exePath}`

  step('Downloading rcedit')
  if (!existsSync(RCEDIT_EXE)) {
    mkdirSync(path.dirname(RCEDIT_EXE), { recursive: true })
    await downloadFile(RCEDIT_URL, RCEDIT_EXE)
    console.log('  Downloaded:', RCEDIT_EXE)
  } else {
    console.log('  Already present:', RCEDIT_EXE)
  }

  step('Setting executable icon and metadata')
  await Bun.sleep(200)
  const rceditArgs = [
    RCEDIT_EXE, exePath,
    '--set-icon', ICON_PATH,
    '--set-version-string', 'FileDescription', 'Mando Debug',
    '--set-version-string', 'ProductName', 'Mando',
    '--set-version-string', 'OriginalFilename', 'mando-debug.exe',
    '--set-version-string', 'InternalName', 'mando-debug',
    '--set-version-string', 'CompanyName', 'Mando',
    '--set-version-string', 'LegalCopyright', 'Copyright (c) 2026 Mando',
    '--set-file-version', '0.1.0',
    '--set-product-version', '0.1.0',
  ]
  const rceditResult = Bun.spawnSync(rceditArgs, { stdio: ['inherit', 'inherit', 'inherit'] })
  if (rceditResult.exitCode !== 0) {
    console.log(`  Warning: rcedit failed (${rceditResult.stderr.toString().trim()}), continuing...`)
  }

  step('Smoke test')
  const proc = Bun.spawn([exePath], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, MANDO_DEBUG: '1' }
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

  console.log(`\n[build:debug] OK → ${exePath}`)
}

main().catch(err => {
  console.error('[build:debug] FAILED:', err)
  process.exit(1)
})
