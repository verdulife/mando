import { PUBLIC_FILES } from './public-embedded.js'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'

let extractedDir: string | null = null

function isDev(): boolean {
  // In development, src/public exists next to this file. In the compiled
  // executable, import.meta.dir is a virtual path like B:/~BUN/root/.
  return existsSync(path.join(import.meta.dir, 'public'))
}

function extractPublicFiles(): string {
  if (extractedDir) return extractedDir

  const dir = path.join(os.tmpdir(), 'mando-public', process.pid.toString())
  mkdirSync(dir, { recursive: true })

  for (const [relativePath, base64] of Object.entries(PUBLIC_FILES)) {
    const dest = path.join(dir, relativePath)
    mkdirSync(path.dirname(dest), { recursive: true })
    writeFileSync(dest, Buffer.from(base64, 'base64'))
  }

  extractedDir = dir
  return dir
}

export function getPublicDir(): string {
  if (isDev()) {
    return path.join(import.meta.dir, 'public')
  }
  return extractPublicFiles()
}

export function getPublicIconPath(): string {
  return path.join(getPublicDir(), 'icons', 'icon.ico')
}
