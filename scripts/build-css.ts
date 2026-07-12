import { readFile, writeFile } from 'fs/promises'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname!, '..')
const INPUT = path.join(ROOT, 'src', 'public', 'styles-input.css')
const OUTPUT = path.join(ROOT, 'src', 'public', 'styles.css')

async function main() {
  const postcss = (await import('postcss')).default
  const plugin = (await import('@tailwindcss/postcss')).default

  const css = await readFile(INPUT, 'utf-8')
  const result = await postcss([plugin]).process(css, { from: INPUT, to: OUTPUT })
  await writeFile(OUTPUT, result.css)
  console.log(`Generado ${OUTPUT} (${result.css.length} bytes)`)
}

main().catch(err => {
  console.error('[build:css] FAILED:', err)
  process.exit(1)
})
