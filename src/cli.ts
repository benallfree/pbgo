#!/usr/bin/env node

import { Command } from 'commander'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pbgo } from './index'
import * as dockerProvider from './providers/docker'
import * as podmanProvider from './providers/podman'

function getPbgorcPath(baseDir: string): string {
  return path.join(baseDir, '.pbgorc')
}

function readDefaultVersionFromConfig(baseDir: string): string | null {
  try {
    const configPath = getPbgorcPath(baseDir)
    if (existsSync(configPath)) {
      const contents = readFileSync(configPath, 'utf8').trim()
      if (!contents) return null
      try {
        const parsed = JSON.parse(contents) as { version?: string }
        if (parsed && typeof parsed.version === 'string' && parsed.version.trim() !== '') {
          return parsed.version.trim()
        }
      } catch (_) {
        return null
      }
    }
  } catch (_) {}
  return null
}

function writeDefaultVersionToConfig(baseDir: string, version: string): void {
  const configPath = getPbgorcPath(baseDir)
  let existing: any = {}
  try {
    if (existsSync(configPath)) {
      const contents = readFileSync(configPath, 'utf8')
      existing = JSON.parse(contents)
    }
  } catch (_) {
    existing = {}
  }
  const data = { ...existing, version }
  writeFileSync(configPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function readProviderFromConfig(baseDir: string): 'podman' | 'docker' | null {
  try {
    const configPath = getPbgorcPath(baseDir)
    if (existsSync(configPath)) {
      const contents = readFileSync(configPath, 'utf8').trim()
      if (!contents) return null
      try {
        const parsed = JSON.parse(contents) as { provider?: string }
        const provider = (parsed?.provider || '').trim().toLowerCase()
        if (provider === 'podman' || provider === 'docker') return provider
      } catch (_) {
        return null
      }
    }
  } catch (_) {}
  return null
}

async function listDockerHubTags(namespace: string, repository: string): Promise<string[]> {
  let page = 1
  const pageSize = 100
  let allTags: string[] = []
  try {
    while (true) {
      const url = `https://registry.hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/tags?page_size=${pageSize}&page=${page}`
      const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
      if (!response.ok) {
        if (response.status === 404) break
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      const data = (await response.json()) as { results?: Array<{ name: string }> }
      if (!data.results || data.results.length === 0) break
      const tags = data.results.map((tag) => tag.name)
      allTags = allTags.concat(tags)
      page++
    }
    return allTags
  } catch (_) {
    return []
  }
}

function detectContainerRuntime(): 'podman' | 'docker' | null {
  if (podmanProvider.check()) return 'podman'
  if (dockerProvider.check()) return 'docker'
  return null
}

// Parse HTTP address into host and port
function parseHttpAddress(httpAddress: string | undefined): { host: string; port: number } {
  if (!httpAddress) {
    return { host: '0.0.0.0', port: 8090 }
  }

  const parts = httpAddress.split(':')
  if (parts.length === 1) {
    // Just port number
    return { host: '0.0.0.0', port: parseInt(parts[0] || '8090', 10) || 8090 }
  } else if (parts.length === 2) {
    // host:port
    return { host: parts[0] || '0.0.0.0', port: parseInt(parts[1] || '8090', 10) || 8090 }
  } else {
    // Invalid format, use defaults
    return { host: '0.0.0.0', port: 8090 }
  }
}

function parsePocketBaseDirectoryArgs(
  dir?: string,
  hooksDir?: string,
  publicDir?: string,
  migrationsDir?: string
): { binds: Record<string, string>; dataDir: string } {
  const binds: Record<string, string> = {}

  // Default --dir to <cwd>/pb_data if not specified
  const dataDir = dir || path.join(process.cwd(), 'pb_data')

  // Helper function to ensure directory exists
  const ensureDir = (dirPath: string): string => {
    const resolvedPath = path.resolve(dirPath)
    if (!existsSync(resolvedPath)) {
      try {
        mkdirSync(resolvedPath, { recursive: true })
        console.log(`Created directory: ${resolvedPath}`)
      } catch (error) {
        console.error(`Failed to create directory ${resolvedPath}:`, (error as Error).message)
        process.exit(1)
      }
    }
    return resolvedPath
  }

  // Handle --dir (or default)
  const resolvedDataDir = ensureDir(dataDir)
  binds['pb_data'] = resolvedDataDir
  const dirParent = path.dirname(resolvedDataDir)

  // Handle explicit directory overrides
  if (hooksDir) {
    binds['pb_hooks'] = ensureDir(hooksDir)
  }
  if (publicDir) {
    binds['pb_public'] = ensureDir(publicDir)
  }
  if (migrationsDir) {
    binds['pb_migrations'] = ensureDir(migrationsDir)
  }

  // If we haven't explicitly set other directories, derive them from the parent
  if (!binds['pb_hooks']) {
    binds['pb_hooks'] = ensureDir(path.join(dirParent, 'pb_hooks'))
  }
  if (!binds['pb_public']) {
    binds['pb_public'] = ensureDir(path.join(dirParent, 'pb_public'))
  }
  if (!binds['pb_migrations']) {
    binds['pb_migrations'] = ensureDir(path.join(dirParent, 'pb_migrations'))
  }

  return { binds, dataDir: resolvedDataDir }
}

async function handleVersions() {
  console.log('Fetching available PocketBase versions from Docker Hub...')
  const tags = await listDockerHubTags('benallfree', 'pocketbase')
  if (tags.length > 0) {
    console.log('Available PocketBase versions:')
    for (const tag of tags) console.log(`  ${tag}`)
  } else {
    console.log('No versions found or error occurred')
  }
}

async function runPocketBase(
  isTermMode: boolean,
  options: {
    host?: string
    port?: number
    use?: string
    provider?: 'podman' | 'docker'
    dir?: string
    hooksDir?: string
    publicDir?: string
    migrationsDir?: string
  },
  passthroughArgs: string[]
) {
  const cliProviderRaw = options.provider?.toLowerCase()
  if (cliProviderRaw && cliProviderRaw !== 'podman' && cliProviderRaw !== 'docker') {
    console.error("Error: --provider must be 'podman' or 'docker'")
    process.exit(1)
  }

  // Parse PocketBase directory arguments and convert them to bind mounts
  const { binds, dataDir } = parsePocketBaseDirectoryArgs(
    options.dir,
    options.hooksDir,
    options.publicDir,
    options.migrationsDir
  )

  // Use the parent directory of the data dir for config operations
  const configDir = path.dirname(dataDir)

  const cliProvider = (cliProviderRaw as 'podman' | 'docker' | undefined) || null
  const preferredProvider = cliProvider || readProviderFromConfig(configDir)
  let runtime: 'podman' | 'docker' | null = null
  if (preferredProvider) {
    const isAvailable = preferredProvider === 'podman' ? podmanProvider.check() : dockerProvider.check()
    if (!isAvailable) {
      console.error(`Error: Provider '${preferredProvider}' is not available on PATH`)
      process.exit(1)
    }
    runtime = preferredProvider
  } else {
    runtime = detectContainerRuntime()
    if (!runtime) {
      console.error('Error: Neither Podman nor Docker is available on PATH')
      process.exit(1)
    }
  }

  const defaultVersion = readDefaultVersionFromConfig(configDir) || 'latest'
  const version = (options.use ?? defaultVersion).trim()

  const port = options.port ?? 8090
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    console.error('Error: Port must be a valid number between 1 and 65535')
    process.exit(1)
  }

  const runtimeOk = runtime === 'podman' ? podmanProvider.check() : dockerProvider.check()
  if (!runtimeOk) {
    console.error(`Error: Selected provider '${runtime}' is not available on PATH`)
    process.exit(1)
  }

  const { command, args: providerArgs } = pbgo({
    host: options.host,
    port,
    version,
    args: passthroughArgs,
    isTermMode,
    runtime,
    binds,
  })

  console.log(`Running ${command} ${providerArgs.join(' ')}`)

  const child = spawn(command, providerArgs, { stdio: 'inherit', shell: true })
  child.on('error', (error) => {
    console.error('Error running PocketBase:', (error as any).message)
    process.exit(1)
  })
  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

// CLI setup with Commander.js
const program = new Command()

program.name('pbgo').description('PocketBase container runner').version('0.0.1-rc.4').enablePositionalOptions() // Required for passThroughOptions on subcommands

// Global options
program
  .option('--http <address>', 'HTTP server address (default: 0.0.0.0:8090)', '0.0.0.0:8090')
  .option('-u, --use <version>', 'Run with specific PocketBase version')
  .option('-r, --provider <provider>', 'Select provider: podman|docker')
  .option('-t, --term', 'Run in terminal mode')
  .option('--dir <dir>', 'PocketBase data directory (default: <cwd>/pb_data)')
  .option('--hooksDir <hooksDir>', 'PocketBase hooks directory')
  .option('--publicDir <publicDir>', 'PocketBase public directory')
  .option('--migrationsDir <migrationsDir>', 'PocketBase migrations directory')
  .allowUnknownOption() // Allow unknown options to be passed through

// Default command (run PocketBase)
program
  .argument('[args...]', 'Arguments to pass to PocketBase')
  .allowExcessArguments()
  .passThroughOptions()
  .action(async (args, options) => {
    const { host, port } = parseHttpAddress(options.http)

    await runPocketBase(
      !!options.term,
      {
        host,
        port,
        use: options.use,
        provider: options.provider,
        dir: options.dir,
        hooksDir: options.hooksDir,
        publicDir: options.publicDir,
        migrationsDir: options.migrationsDir,
      },
      args
    )
  })

// Versions command
program
  .command('versions')
  .description('List available PocketBase Docker tags')
  .action(async () => {
    await handleVersions()
  })

// Use command
program
  .command('use <version>')
  .description('Set default PocketBase version')
  .action((version) => {
    try {
      const globalOptions = program.opts()
      const { dataDir } = parsePocketBaseDirectoryArgs(globalOptions.dir)
      const configDir = path.dirname(dataDir)
      writeDefaultVersionToConfig(configDir, version)
      console.log(`Default PocketBase version set to '${version}' in ${getPbgorcPath(configDir)}`)
    } catch (error: any) {
      console.error('Error writing .pbgorc:', error.message)
      process.exit(1)
    }
  })

// Term command
program
  .command('term')
  .description('Run in terminal mode')
  .argument('[args...]', 'Arguments to pass to PocketBase')
  .allowUnknownOption()
  .allowExcessArguments()
  .passThroughOptions()
  .action(async (args) => {
    const globalOptions = program.opts()
    const { host, port } = parseHttpAddress(globalOptions.http)

    await runPocketBase(
      true,
      {
        host,
        port,
        use: globalOptions.use,
        provider: globalOptions.provider,
        dir: globalOptions.dir,
        hooksDir: globalOptions.hooksDir,
        publicDir: globalOptions.publicDir,
        migrationsDir: globalOptions.migrationsDir,
      },
      args
    )
  })
;(async () => {
  await program.parseAsync()
})()
