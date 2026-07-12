import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'
import { VIGEM_FILES } from './vigem-embedded.js'

// We cannot `import ... with { type: 'file' }` a .node file because Bun tries
// to load it as a Node-API module. Instead we rely on the `require('vigemclient')`
// usage to embed the .node automatically, and we embed the dependency DLL under
// a non-.dll extension so Bun treats it as a plain file.
import dllAsset from '../node_modules/vigemclient/build/Release/ViGEmClient.dll.bin' with { type: 'file' }

// Keep the import alive so bun build --compile does not tree-shake it.
const _keepDll = dllAsset

let cachedModule: any = null

const DEBUG = process.env.MANDO_DEBUG === '1'

function log(...args: any[]) {
  if (!DEBUG) return
  // Use console.error so logs survive --windows-hide-console builds when stderr is captured.
  console.error('[vigem-loader]', ...args)
}

async function extractFile(embeddedFile: File, dest: string) {
  if (existsSync(dest)) {
    log('Already extracted:', dest, 'size:', statSync(dest).size)
    return
  }

  const buf = await embeddedFile.arrayBuffer()
  writeFileSync(dest, new Uint8Array(buf))
  log('Extracted:', dest, 'size:', statSync(dest).size)
}

function writePackage(extractDir: string) {
  for (const [relativePath, content] of Object.entries(VIGEM_FILES)) {
    const dest = path.join(extractDir, relativePath)
    mkdirSync(path.dirname(dest), { recursive: true })
    if (!existsSync(dest)) {
      writeFileSync(dest, content)
      log('Wrote:', dest)
    }
  }
}

export async function loadVigemClient(): Promise<any> {
  if (cachedModule) return cachedModule

  try {
    // Running from bun build --compile? Bun.embeddedFiles is available.
    const embedded = (Bun as any).embeddedFiles as File[] | undefined
    log('embeddedFiles count:', embedded?.length ?? 0)
    embedded?.forEach(f => log('embedded:', f.name, 'size:', f.size))

    if (embedded && embedded.length > 0) {
      const nodeFile = embedded.find(f => f.name?.includes('vigemclient') && f.name?.endsWith('.node'))
      const dllFile = embedded.find(f => f.name?.includes('ViGEmClient') && f.name?.endsWith('.bin'))

      if (nodeFile && dllFile) {
        // Reconstruct the vigemclient package on disk so Node can resolve
        // ../build/Release/vigemclient from the JS wrappers normally.
        const extractDir = path.join(os.tmpdir(), 'mando-vigem', process.pid.toString())
        const pkgDir = path.join(extractDir, 'vigemclient')
        mkdirSync(pkgDir, { recursive: true })
        log('extractDir:', extractDir)

        const nodePath = path.join(pkgDir, 'build', 'Release', 'vigemclient.node')
        const dllPath = path.join(pkgDir, 'build', 'Release', 'ViGEmClient.dll')

        mkdirSync(path.dirname(nodePath), { recursive: true })
        await extractFile(nodeFile, nodePath)
        await extractFile(dllFile, dllPath)
        writePackage(pkgDir)

        log('Loading vigemclient package from:', pkgDir)
        cachedModule = require(pkgDir)
        log('Package loaded successfully')
        return cachedModule
      }
    }
  } catch (err) {
    log('Failed to load embedded vigemclient:', err)
    // Fall through to normal resolution, which will likely fail inside a
    // standalone executable but keeps development working.
  }

  // Fallback: normal node_modules resolution (development).
  log('Falling back to require(vigemclient)')
  cachedModule = require('vigemclient')
  return cachedModule
}
