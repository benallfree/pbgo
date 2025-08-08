#!/usr/bin/env node

import { Command } from 'commander'
import { spawn } from 'node:child_process'
import { version as pkgVersion } from '../../package.json'
import { normalizeOptions, pbgo } from '../index'
import { config } from './config'

const PBGO_OPTIONS = [
  '--http',
  '--use',
  '--runtime',
  '--term',
  '--dir',
  '--hooksDir',
  '--publicDir',
  '--migrationsDir',
  '--version',
  '--verbose',
  '-u',
  '-r',
  '-t',
  '-v',
]

export type CliOptions = {
  http: string
  use: string
  runtime: 'podman' | 'docker'
  term: boolean
  dir: string
  hooksDir: string
  publicDir: string
  migrationsDir: string
  version: boolean
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

// CLI setup with Commander.js
const program = new Command().enablePositionalOptions()

program.name('pbgo').description('PocketBase container runner')

function displayVersionInfo(options: CliOptions) {
  console.log(`pbgo version: ${pkgVersion}`)

  const cmd = pbgo({ ...options, args: ['--version'] })

  // Capture PocketBase version output
  const child = spawn(cmd.command, cmd.args, { stdio: ['ignore', 'pipe', 'inherit'] })

  let pocketbaseVersion = ''
  child.stdout?.on('data', (data: Buffer) => {
    pocketbaseVersion += data.toString()
  })

  return new Promise((resolve) => {
    child.on('exit', (code: number | null) => {
      if (code === 0) {
        // Extract version from output (e.g., "pocketbase version 0.29.1" -> "0.29.1")
        const versionMatch = pocketbaseVersion.match(/pocketbase version (\S+)/)
        const actualVersion = versionMatch ? versionMatch[1] : 'unknown'
        console.log(`PocketBase container version: ${actualVersion} (tag: ${options.use})`)
      } else {
        console.log(`PocketBase container version: unknown (tag: ${options.use})`)
      }
      process.exit(code ?? 0)
    })
  })
}

// Default command (run PocketBase)
program
  .argument('[args...]', 'Arguments to pass to PocketBase')
  .option('--http <address>', 'HTTP server address', '0.0.0.0:8090')
  .option('-u, --use <version>', 'Run with specific PocketBase version', config.version)
  .option('-r, --runtime <runtime>', 'Select runtime: podman|docker', config.runtime)
  .option('-t, --term', 'Run in terminal mode')
  .option('--dir <dir>', 'PocketBase data directory', './pb_data')
  .option('--hooksDir <hooksDir>', 'PocketBase hooks directory', './pb_hooks')
  .option('--publicDir <publicDir>', 'PocketBase public directory', './pb_public')
  .option('--migrationsDir <migrationsDir>', 'PocketBase migrations directory', './pb_migrations')
  .option('-v, --version', 'display version information')
  .option('--verbose', 'Verbose output')
  .allowExcessArguments()
  .allowUnknownOption()
  .passThroughOptions()
  .action(async (args: string[]) => {
    const options = program.opts<CliOptions>()
    // Handle version request - show both pbgo and PocketBase versions
    if (options.version) {
      await displayVersionInfo(options)
    }

    const { host, port } = parseHttpAddress(options.http)

    const pbgoOptions = normalizeOptions({
      ...options,
      host,
      port,
      args: args.filter((arg, index, arr) => {
        // Remove pbgo options in --option=value format
        if (PBGO_OPTIONS.some((opt) => arg.startsWith(`${opt}=`))) return false
        // Remove pbgo options in --option value format
        if (PBGO_OPTIONS.includes(arg)) return false
        if (index > 0 && PBGO_OPTIONS.includes(arr[index - 1]!)) return false
        return true
      }),
    })

    const pbgoCmd = pbgo(pbgoOptions)
    const child = spawn(pbgoCmd.command, pbgoCmd.args, { stdio: 'inherit', shell: true })
    child.on('exit', (code) => {
      process.exit(code ?? 0)
    })
  })
;(async () => {
  await program.parseAsync()
})()
