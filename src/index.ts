import { Transform } from 'node:stream'
import { ensureDir } from './dir'
import type { PbgoOptions } from './types'
export { findAvailablePort } from './port'

export const normalizeOptions = (partialOptions: Partial<PbgoOptions>): PbgoOptions => {
  const options: PbgoOptions = {
    host: '0.0.0.0',
    port: 8090,
    use: 'latest',
    args: [],
    isTermMode: false,
    runtime: 'docker',
    binds: {},
    dir: './pb_data',
    hooksDir: './pb_hooks',
    publicDir: './pb_public',
    migrationsDir: './pb_migrations',
    verbose: false,
    ...partialOptions,
  }

  const { dir, hooksDir, publicDir, migrationsDir, binds } = options
  binds['pb_data'] = ensureDir(dir)
  binds['pb_hooks'] = ensureDir(hooksDir)
  binds['pb_public'] = ensureDir(publicDir)
  binds['pb_migrations'] = ensureDir(migrationsDir)
  return options
}

export function pbgo(partialOptions: Partial<PbgoOptions>) {
  const options: PbgoOptions = normalizeOptions(partialOptions)

  const { binds, host, port, use, isTermMode, args: userArgs, runtime } = options

  const args = [
    'run',
    '--rm',
    isTermMode ? '-it' : '',
    '-p',
    `${host}:${port}:8090`,
    `benallfree/pocketbase:${use}`,
  ].filter(Boolean)

  // Layer additional bind mounts
  for (const [key, hostPath] of Object.entries(binds)) {
    if (!hostPath) continue
    const containerPath = `/data/${key}`
    args.splice(args.length - 1, 0, '-v', `${hostPath}:${containerPath}`)
  }

  if (isTermMode) {
    args.push('bash')
  } else {
    args.push(`pocketbase`)
    args.push(...userArgs)
    args.push(`--dir=/data/pb_data`)
    const hasServeCommand = userArgs.includes('serve')
    if (hasServeCommand) {
      args.push(`"--http=0.0.0.0:8090"`)
    }
  }

  if (options.verbose) console.log(`Assembled command: ${runtime} ${args.join(' ')}`)
  return { command: runtime, args }
}

// Transform stream to replace URLs in output
export function createUrlReplacer(host: string, port: number): Transform {
  return new Transform({
    transform(chunk: Buffer, encoding: string, callback: (error?: Error | null, data?: Buffer) => void) {
      const replaced = chunk.toString().replace(/http:\/\/0\.0\.0\.0:8090/g, `http://${host}:${port}`)
      callback(null, Buffer.from(replaced))
    },
  })
}

export type { PbgoOptions }
