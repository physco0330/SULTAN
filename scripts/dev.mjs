import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const cwd = resolve(import.meta.url, '..')

const server = spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit', cwd })
const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host'], { stdio: 'inherit', cwd })

const stop = (signal) => {
  ;[server, vite].forEach((p) => p.kill(signal))
}
process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))
;[server, vite].forEach((p) => p.on('exit', (code) => stop(code === null ? 'SIGTERM' : undefined)))