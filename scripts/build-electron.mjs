import * as esbuild from 'esbuild'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(root, '..')
const outdir = path.join(projectRoot, 'dist-electron')

fs.rmSync(outdir, { recursive: true, force: true })

await esbuild.build({
  entryPoints: [
    path.join(projectRoot, 'electron/main.ts'),
    path.join(projectRoot, 'electron/preload.ts'),
  ],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outdir,
  format: 'cjs',
  /** With package.json "type":"module", .js is ESM; .cjs forces CommonJS for require(). */
  outExtension: { '.js': '.cjs' },
  external: ['electron'],
  sourcemap: true,
})

console.log('Electron main + preload built to dist-electron/')
