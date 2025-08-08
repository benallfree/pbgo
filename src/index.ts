import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import type { PbgoOptions } from './types'

// Helper function to ensure directory exists
const ensureDir = (dirPath: string, verbose: boolean = false): string => {
  const resolvedPath = path.resolve(dirPath)
  if (!existsSync(resolvedPath)) {
    try {
      mkdirSync(resolvedPath, { recursive: true })
      if (verbose) console.log(`Created directory: ${resolvedPath}`)
    } catch (error) {
      console.error(`Failed to create directory ${resolvedPath}:`, (error as Error).message)
      process.exit(1)
    }
  }
  return resolvedPath
}

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

export type { PbgoOptions }
