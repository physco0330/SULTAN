import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'

const server = spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit', cwd })
const vite = spawn(process.execPath, [resolve(cwd, 'node_modules/vite/bin/vite.js'), '--host'], {
  stdio: 'inherit',
  cwd,
  ...(isWindows ? { shell: false } : {}),
})

const stop = (signal) => {
  ;[server, vite].forEach((p) => p.kill(signal))
}
process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))
;[server, vite].forEach((p) => p.on('exit', (code) => stop(code === null ? 'SIGTERM' : undefined)))