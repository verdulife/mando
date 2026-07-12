import { $ } from 'bun'
import { existsSync } from 'fs'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname!, '..')

async function main() {
  // Generate icons
  const python = process.platform === 'win32'
    ? path.join(ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(ROOT, '.venv', 'bin', 'python')

  if (existsSync(python)) {
    await $`${python} ${path.join(ROOT, 'scripts', 'generate-icons.py')}`
  } else {
    console.log('[postinstall] Python venv not found, skipping icon generation')
  }

  // Generate CSS from Tailwind
  await $`bun run build:css`

  // Generate embedded vigemclient wrappers
  await $`bun run ${path.join(ROOT, 'scripts', 'generate-vigem-embedded.ts')}`

  // Generate embedded public files
  await $`bun run ${path.join(ROOT, 'scripts', 'generate-public-embedded.ts')}`

  // Copy DLL to a non-.dll extension so bun build --compile embeds it as a file
  const dllSrc = path.join(ROOT, 'node_modules', 'vigemclient', 'build', 'Release', 'ViGEmClient.dll')
  const dllDst = path.join(ROOT, 'node_modules', 'vigemclient', 'build', 'Release', 'ViGEmClient.dll.bin')
  if (!existsSync(dllDst)) {
    await Bun.write(dllDst, Bun.file(dllSrc))
    console.log('[postinstall] Copied ViGEmClient.dll -> ViGEmClient.dll.bin')
  }
}

main().catch(err => {
  console.error('[postinstall] FAILED:', err)
  process.exit(1)
})
