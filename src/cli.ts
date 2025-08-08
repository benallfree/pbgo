#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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

;(async () => {
  type PgOptions = {
    port?: number
    use?: string
    provider?: 'podman' | 'docker'
    term?: boolean
    listVersions?: boolean
  }

  function printHelp() {
    const help = `pbgo - PocketBase container runner

Usage:
  pbgo [term] [--] [DOWNSTREAM ARGS...]
  pbgo versions
  pbgo use <version>

PBGO options (prefixed with pg and filtered from downstream):
  --pg-port, -pgp <port>           Port to expose (default 8090)
  --pg-use, -pgu <version>         Run with specific PocketBase version
  --pg-provider, -pgr <provider>   Select provider: podman|docker
  --pg-term, -pgt                  Run in terminal mode
  --pg-versions, -pgV              List available PocketBase Docker tags and exit
  --help                           Show this help
`
    console.log(help)
  }

  function parseArgs(argv: string[]): {
    pg: PgOptions
    passthrough: string[]
    command?: 'versions' | 'use' | 'run'
    useVersionArg?: string
  } {
    const pg: PgOptions = {}
    const passthrough: string[] = []
    let i = 0
    let endOfOptions = false
    let command: 'versions' | 'use' | 'run' | undefined
    let useVersionArg: string | undefined

    const takeValue = (currentToken: string, nextToken?: string): { value?: string; consumedNext: boolean } => {
      // Handles --opt=value, -pgx=value, -pgxVALUE and their spaced variants
      const eqIdx = currentToken.indexOf('=')
      if (eqIdx >= 0) {
        return { value: currentToken.slice(eqIdx + 1), consumedNext: false }
      }
      if (nextToken && !nextToken.startsWith('-')) {
        return { value: nextToken, consumedNext: true }
      }
      // Attached short style for -pgxVALUE (no '=')
      return { value: undefined, consumedNext: false }
    }

    while (i < argv.length) {
      const tok = argv[i]!
      const next = i + 1 < argv.length ? argv[i + 1]! : undefined

      if (endOfOptions) {
        passthrough.push(tok)
        i++
        continue
      }

      if (tok === '--') {
        endOfOptions = true
        i++
        continue
      }

      // Positional commands handled by pbgo itself
      if (!tok.startsWith('-')) {
        if (!command && tok === 'versions') {
          command = 'versions'
          i++
          continue
        }
        if (!command && tok === 'use') {
          command = 'use'
          if (next && !next.startsWith('-')) {
            useVersionArg = next
            i += 2
          } else {
            i++
          }
          continue
        }
        if (!command && tok === 'term') {
          pg.term = true
          i++
          continue
        }
        // Any other positional goes downstream
        passthrough.push(tok)
        i++
        continue
      }

      // Long pg options: --pg-*
      if (tok.startsWith('--pg-')) {
        const namePart = tok.slice(5)
        const [nameOnly] = namePart.split('=')
        const { value, consumedNext } = takeValue(tok, next)
        switch (nameOnly) {
          case 'port': {
            const raw = value ?? (next && !next.startsWith('-') ? next : undefined) ?? ''
            const parsed = parseInt(raw, 10)
            if (!Number.isNaN(parsed)) pg.port = parsed
            if (value === undefined && consumedNext) i++
            i++
            continue
          }
          case 'use': {
            const v = value ?? (next && !next.startsWith('-') ? next : undefined)
            if (typeof v === 'string') pg.use = v
            if (value === undefined && consumedNext) i++
            i++
            continue
          }
          case 'provider': {
            const v = (value ?? (next && !next.startsWith('-') ? next : undefined))?.toLowerCase()
            if (v === 'podman' || v === 'docker') pg.provider = v
            if (value === undefined && consumedNext) i++
            i++
            continue
          }
          case 'term': {
            pg.term = true
            i++
            continue
          }
          case 'versions': {
            pg.listVersions = true
            i++
            continue
          }
          case 'help': {
            printHelp()
            process.exit(0)
          }
          default: {
            // Unknown pg option: ignore from downstream to avoid breaking downstream tools
            i++
            continue
          }
        }
      }

      // Short pg options: -pgx[=]value?
      if (tok.startsWith('-pg') && tok.length >= 4) {
        const keyAndMaybeValue = tok.slice(3)
        const key = keyAndMaybeValue[0]
        const rest = keyAndMaybeValue.slice(1)
        const eqIdx = rest.indexOf('=')
        const attached = eqIdx >= 0 ? rest.slice(eqIdx + 1) : rest
        const hasExplicitEq = eqIdx >= 0
        const valFromNext = next && !next.startsWith('-') ? next : undefined
        const take = (needsValue: boolean): string | undefined => {
          if (hasExplicitEq) return attached
          if (attached) return attached
          if (needsValue) return valFromNext
          return undefined
        }
        switch (key) {
          case 'p': {
            const raw = take(true)
            if (raw !== undefined) {
              const parsed = parseInt(raw, 10)
              if (!Number.isNaN(parsed)) pg.port = parsed
            }
            if (!hasExplicitEq && !attached && valFromNext !== undefined) i++
            i++
            continue
          }
          case 'u': {
            const v = take(true)
            if (v !== undefined) pg.use = v
            if (!hasExplicitEq && !attached && valFromNext !== undefined) i++
            i++
            continue
          }
          case 'r': {
            const v = take(true)?.toLowerCase()
            if (v === 'podman' || v === 'docker') pg.provider = v
            if (!hasExplicitEq && !attached && valFromNext !== undefined) i++
            i++
            continue
          }
          case 't': {
            pg.term = true
            i++
            continue
          }
          case 'V': {
            pg.listVersions = true
            i++
            continue
          }
          default: {
            // Unknown -pgX : drop it to avoid breaking downstream
            i++
            continue
          }
        }
      }

      // Non-pg option -> passthrough untouched
      passthrough.push(tok)
      i++
    }

    if (!command) command = 'run'
    return { pg, passthrough, command, useVersionArg }
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
    options: { port?: number; use?: string; provider?: 'podman' | 'docker' },
    passthroughArgs: string[]
  ) {
    const currentDir = process.cwd()
    const cliProviderRaw = (options.provider as string | undefined)?.toLowerCase()
    if (cliProviderRaw && cliProviderRaw !== 'podman' && cliProviderRaw !== 'docker') {
      console.error("Error: --pg-provider must be 'podman' or 'docker'")
      process.exit(1)
    }
    const cliProvider = (cliProviderRaw as 'podman' | 'docker' | undefined) || null
    const preferredProvider = cliProvider || readProviderFromConfig(currentDir)
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

    const defaultVersion = readDefaultVersionFromConfig(currentDir) || 'latest'
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
      currentDir,
      port,
      version,
      args: passthroughArgs,
      isTermMode,
      runtime,
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

  // Entry
  const argv = process.argv.slice(2)
  const { pg, passthrough, command, useVersionArg } = parseArgs(argv)

  if (pg.listVersions || command === 'versions') {
    await handleVersions()
    process.exit(0)
  }

  if (command === 'use') {
    const version = useVersionArg
    if (!version) {
      console.error("Error: 'use' requires a <version> argument")
      process.exit(1)
    }
    try {
      const currentDir = process.cwd()
      writeDefaultVersionToConfig(currentDir, version)
      console.log(`Default PocketBase version set to '${version}' in ${getPbgorcPath(currentDir)}`)
      process.exit(0)
    } catch (error: any) {
      console.error('Error writing .pbgorc:', error.message)
      process.exit(1)
    }
  }

  await runPocketBase(!!pg.term, { port: pg.port, use: pg.use, provider: pg.provider }, passthrough)
})()
