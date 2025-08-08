#!/usr/bin/env bun

import { execSync } from 'child_process'
import { readFileSync } from 'fs'

// Configuration
const REGISTRY = process.env.REGISTRY || 'benallfree'
const IMAGE_NAME = process.env.IMAGE_NAME || 'pocketbase'
const PLATFORMS = 'linux/amd64,linux/arm64,linux/arm/v7,linux/arm/v8'
const LIMIT = parseInt(process.env.LIMIT || '5', 10)

// Colors for output
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const NC = '\x1b[0m'

interface BuildOptions {
  push: boolean
  registry: string
  name: string
  limit: number
  platforms: string
}

const log = (message: string) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19)
  console.log(`${BLUE}[${timestamp}]${NC} ${message}`)
}

const error = (message: string) => {
  console.error(`${RED}[ERROR]${NC} ${message}`)
}

const success = (message: string) => {
  console.log(`${GREEN}[SUCCESS]${NC} ${message}`)
}

const warn = (message: string) => {
  console.log(`${YELLOW}[WARNING]${NC} ${message}`)
}

const execCommand = (command: string): string => {
  try {
    log(`Executing command: ${command}`)
    return execSync(command, { encoding: 'utf8', stdio: 'inherit' })
  } catch (err) {
    throw new Error(`Command failed: ${command}`)
  }
}

const execCommandSilent = (command: string): string => {
  try {
    log(`Executing command: ${command}`)
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' })
  } catch (err) {
    throw new Error(`Command failed: ${command}`)
  }
}

const loadVersions = (): string[] => {
  try {
    const content = readFileSync('versions.json', 'utf8')
    const versions = JSON.parse(content)

    // Sort versions semantically from lowest to highest
    return versions.sort((a: string, b: string) => {
      const aParts = a.split('.').map(Number)
      const bParts = b.split('.').map(Number)

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0
        const bPart = bParts[i] || 0

        if (aPart !== bPart) {
          return aPart - bPart
        }
      }

      return 0
    })
  } catch (err) {
    error('Could not load versions.json. Please run update-versions.ts first.')
    process.exit(1)
  }
}

const checkDockerBuildx = (): void => {
  try {
    execCommandSilent('docker buildx version')
  } catch (err) {
    error('docker buildx is not available. Please install Docker with buildx support.')
    process.exit(1)
  }
}

const setupBuildxBuilder = (): void => {
  const BUILDER_NAME = 'pocketbase'

  try {
    const builders = execCommandSilent('docker buildx ls')
    if (!builders.includes(BUILDER_NAME)) {
      log(`Creating buildx builder: ${BUILDER_NAME}`)
      execCommand(`docker buildx create --name "${BUILDER_NAME}" --driver docker-container --bootstrap`)
    }

    execCommand(`docker buildx use "${BUILDER_NAME}"`)
  } catch (err) {
    error(`Failed to setup buildx builder: ${err}`)
    process.exit(1)
  }
}

const extractMinorVersion = (version: string): string | null => {
  const match = version.match(/^([0-9]+\.[0-9]+)\.[0-9]+$/)
  return match ? match[1] : null
}

const buildVersion = async (version: string, options: BuildOptions): Promise<boolean> => {
  const tag = `${options.registry}/${options.name}:${version}`
  const latestTag = `${options.registry}/${options.name}:latest`
  const minorVersion = extractMinorVersion(version)
  const minorTag = minorVersion ? `${options.registry}/${options.name}:${minorVersion}` : null

  // Determine output method and platforms
  const outputFlag = options.push ? '--push' : '--load'
  const buildPlatforms = options.push ? options.platforms : 'linux/arm64/v8'

  if (options.push) {
    log(`Building ${tag} for platforms: ${buildPlatforms} (pushing to registry)`)
  } else {
    log(`Building ${tag} for platform: ${buildPlatforms} (loading locally)`)
  }

  // Build with all tags in a single command
  let buildTags = `--tag ${tag}`
  if (minorTag) {
    buildTags += ` --tag ${minorTag}`
    log(`Building ${version} → tagging as both ${version} and ${minorVersion}`)
  }

  // Add latest tag if this is the highest version
  const versions = loadVersions()
  if (version === versions[versions.length - 1]) {
    buildTags += ` --tag ${latestTag}`
    log(`Building ${version} → also tagging as latest`)
  }

  try {
    const buildCommand = `docker buildx build \
      --platform "${buildPlatforms}" \
      --build-arg "POCKETBASE_VERSION=${version}" \
      ${buildTags} \
      "${outputFlag}" \
      .`

    execCommand(buildCommand)
    success(`Built ${tag}`)

    if (minorTag) {
      success(`Also tagged ${minorTag}`)
    }

    if (version === versions[versions.length - 1]) {
      success(`Also tagged ${latestTag}`)
    }

    return true
  } catch (err) {
    error(`Failed to build ${tag}`)
    warn(`Skipping ${version} and continuing with next version`)
    return false
  }
}

const showHelp = (): void => {
  console.log(`
Multi-arch Docker build script for PocketBase instances

Usage: node build.ts [OPTIONS]

Options:
    -p, --push          Push images to registry after building
    -r, --registry      Registry name (default: benallfree)
    -n, --name          Image name (default: pocketbase)
    -l, --limit         Number of most recent versions to build (default: 5)
    --platforms         Comma-separated list of platforms (default: linux/amd64,linux/arm64,linux/arm/v7)
    -h, --help          Show this help message

Environment variables:
    REGISTRY            Registry name (overrides -r)
    IMAGE_NAME          Image name (overrides -n)
    LIMIT               Number of versions to build (overrides -l)
    PUSH                Set to 'true' to push images

Examples:
    # Build 5 most recent versions locally (default)
    node build.ts

    # Build and push 10 most recent versions
    node build.ts --push --limit 10

    # Build all versions
    node build.ts --limit 0

    # Build with custom registry
    node build.ts --registry myregistry --push

    # Build with environment variables
    REGISTRY=myregistry IMAGE_NAME=my-pocketbase LIMIT=3 PUSH=true node build.ts
`)
}

const parseArgs = (): BuildOptions => {
  const args = process.argv.slice(2)
  const options: BuildOptions = {
    push: process.env.PUSH === 'true',
    registry: REGISTRY,
    name: IMAGE_NAME,
    limit: LIMIT,
    platforms: PLATFORMS,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '-p':
      case '--push':
        options.push = true
        break
      case '-r':
      case '--registry':
        options.registry = args[++i]
        break
      case '-n':
      case '--name':
        options.name = args[++i]
        break
      case '-l':
      case '--limit':
        options.limit = parseInt(args[++i], 10)
        break
      case '--platforms':
        options.platforms = args[++i]
        break
      case '-h':
      case '--help':
        showHelp()
        process.exit(0)
        break
      default:
        error(`Unknown option: ${arg}`)
        showHelp()
        process.exit(1)
    }
  }

  return options
}

const main = async (): Promise<void> => {
  try {
    const options = parseArgs()

    log('Starting multi-arch build process')
    log(`Registry: ${options.registry}`)
    log(`Image: ${options.name}`)
    log(`Platforms: ${options.platforms}`)
    log(`Push: ${options.push}`)
    log(`Limit: ${options.limit} versions`)

    checkDockerBuildx()
    setupBuildxBuilder()

    const versions = loadVersions()
    const limitedVersions = options.limit === 0 ? versions : versions.slice(-options.limit)

    if (options.limit === 0) {
      log(`Building ALL ${limitedVersions.length} versions: ${limitedVersions.slice(0, 10).join(', ')}...`)
    } else {
      log(`Building ${limitedVersions.length} versions: ${limitedVersions.join(', ')}`)
    }

    // Build each version
    const successfulBuilds: string[] = []
    for (const version of limitedVersions) {
      const success = await buildVersion(version, options)
      if (success) {
        successfulBuilds.push(version)
      }
    }

    if (successfulBuilds.length > 0) {
      success(
        `Build process completed! ${successfulBuilds.length}/${limitedVersions.length} versions built successfully.`
      )

      // Show built images
      log('Successfully built images:')
      for (const version of successfulBuilds) {
        console.log(`  ${options.registry}/${options.name}:${version}`)
        const minorVersion = extractMinorVersion(version)
        if (minorVersion) {
          console.log(`  ${options.registry}/${options.name}:${minorVersion}`)
        }
      }
      if (successfulBuilds.includes(limitedVersions[limitedVersions.length - 1])) {
        console.log(`  ${options.registry}/${options.name}:latest`)
      }
    } else {
      error('No versions were built successfully.')
    }
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
