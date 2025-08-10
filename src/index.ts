import { join, resolve } from 'node:path'
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
    dir: '',
    hooksDir: '',
    publicDir: '',
    migrationsDir: '',
    verbose: false,
    ...partialOptions,
  }

  const { binds } = options
  const dir = options.dir || 'pb_data'
  const root = resolve(join(dir, '..'))
  const hooksDir = options.hooksDir || join(root, 'pb_hooks')
  const publicDir = options.publicDir || join(root, 'pb_public')
  const migrationsDir = options.migrationsDir || join(root, 'pb_migrations')

  binds['/app'] = process.cwd()
  binds['/app/.pbgo_cache'] = ensureDir(join(process.cwd(), '.pbgo_cache'))
  binds['/pb/pb_data'] = ensureDir(dir)
  binds['/pb/pb_hooks'] = ensureDir(hooksDir)
  binds['/pb/pb_public'] = ensureDir(publicDir)
  binds['/pb/pb_migrations'] = ensureDir(migrationsDir)

  return options
}

export function pbgo(partialOptions: Partial<PbgoOptions>) {
  const options: PbgoOptions = normalizeOptions(partialOptions)

  const { binds, host, port, use, isTermMode, args: userArgs, runtime } = options

  const args = [
    'run',
    '--rm',
    ...(isTermMode ? ['-it'] : ['-p', `${host}:${port}:8090`]),
    `benallfree/pocketbase:${use}`,
  ].filter(Boolean)

  // Layer additional bind mounts
  for (const [key, hostPath] of Object.entries(binds)) {
    if (!hostPath) continue
    args.splice(args.length - 1, 0, '-v', `${hostPath}:${key}`)
  }

  if (isTermMode) {
    args.push('bash')
  } else {
    args.push(`pocketbase`)
    args.push(`--dir=/pb/pb_data`)
    args.push(...userArgs)
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
