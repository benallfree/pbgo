#!/usr/bin/env bun

import { execSync } from 'child_process'
import { Command } from 'commander'
import { readFileSync } from 'fs'
import { major, minor, parse, compare as semverCompare, valid } from 'semver'

// Configuration
const REGISTRY = 'benallfree'
const IMAGE_NAME = 'pocketbase'
const PLATFORMS = 'linux/amd64,linux/arm64,linux/arm/v7,linux/arm/v8'
const LIMIT = 5

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
  force: boolean
  versionsFile: string
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

// Using `semver.compare` for reliable semver ordering

const getPlatformsForVersion = (version: string): string => {
  const [major, minor] = version.split('.').map(Number)
  if (major === 0 && minor < 10) {
    return 'linux/amd64,linux/arm64' // Older versions only support amd64 and arm64
  }
  return 'linux/amd64,linux/arm64,linux/arm/v7,linux/arm/v8' // Newer versions support all architectures
}

const getFallbackPlatforms = (): string => {
  return 'linux/amd64,linux/arm64' // Fallback to just amd64 and arm64
}

const detectLocalArch = (): string => {
  try {
    const arch = process.arch
    switch (arch) {
      case 'x64':
        return 'linux/amd64'
      case 'arm64':
        return 'linux/arm64'
      case 'arm':
        return 'linux/arm/v7'
      default:
        // Fallback to amd64 if we can't determine the arch
        return 'linux/amd64'
    }
  } catch (err) {
    // Fallback to amd64 if detection fails
    return 'linux/amd64'
  }
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

const loadVersions = (versionsFile: string): string[] => {
  try {
    const content = readFileSync(versionsFile, 'utf8')
    const versions = JSON.parse(content)

    // Sort versions semantically from lowest to highest
    return versions.sort(semverCompare)
  } catch (err) {
    error(`Could not load ${versionsFile}. Please run update-versions.ts first.`)
    process.exit(1)
  }
}

const fetchExistingDockerTags = async (registry: string, name: string, push: boolean): Promise<string[]> => {
  if (push) {
    // When pushing, check remote Docker Hub registry
    try {
      log(`Fetching existing Docker Hub tags for ${registry}/${name}...`)

      const tags: string[] = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        const url = `https://hub.docker.com/v2/repositories/${registry}/${name}/tags/?page_size=100&page=${page}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Docker Hub API returned ${response.status}`)
        }

        const data = await response.json()
        const pageTags = data.results.map((tag: any) => tag.name).filter((tag: string) => valid(tag)) // Only valid semver versions

        tags.push(...pageTags)
        hasMore = data.next !== null
        page++
      }

      const sorted = tags.sort(semverCompare)
      log(`Found ${sorted.length} existing patch version tags in Docker Hub: ${sorted.join(', ')}`)
      return sorted
    } catch (err) {
      error(`Failed to fetch existing Docker Hub tags: ${err}`)
      throw err
    }
  } else {
    // When not pushing, check local Docker images
    try {
      log(`Checking local Docker images for ${registry}/${name}...`)

      const output = execCommandSilent(`docker images ${registry}/${name} --format "{{.Tag}}"`)
      const tags = output
        .split('\n')
        .map((tag) => tag.trim())
        .filter((tag: string) => parse(tag))
        .map((tag: string) => tag.trim())

      const sorted = tags.sort(semverCompare)
      log(`Found ${sorted.length} existing patch version tags locally: ${sorted.join(', ')}`)
      return sorted
    } catch (err) {
      log(`No local images found for ${registry}/${name}`)
      return []
    }
  }
}

const findMissingVersions = (desiredVersions: string[], existingTags: string[]): string[] => {
  const existingSet = new Set(existingTags)
  const missing = desiredVersions.filter((version) => !existingSet.has(version))

  if (missing.length > 0) {
    log(`Found ${missing.length} missing versions: ${missing.join(', ')}`)
  } else {
    log('All versions are already built')
  }

  return missing
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
  if (!valid(version)) return null
  return `${major(version)}.${minor(version)}`
}

const shouldUpdateMinorTag = (version: string, allVersions: string[]): boolean => {
  const minorVersion = extractMinorVersion(version)
  if (!minorVersion) return false

  // Find all versions with the same minor version
  const sameMinorVersions = allVersions.filter((v) => extractMinorVersion(v) === minorVersion).sort(semverCompare)

  return version === sameMinorVersions[sameMinorVersions.length - 1]
}

const shouldUpdateLatestTag = (version: string, allVersions: string[]): boolean => {
  // Sort all versions and check if this is the highest one
  const sortedVersions = [...allVersions].sort(semverCompare)

  return version === sortedVersions[sortedVersions.length - 1]
}

const buildVersion = async (version: string, options: BuildOptions, allVersions: string[]): Promise<boolean> => {
  const tag = `${options.registry}/${options.name}:${version}`
  const latestTag = `${options.registry}/${options.name}:latest`
  const minorVersion = extractMinorVersion(version)
  const minorTag = minorVersion ? `${options.registry}/${options.name}:${minorVersion}` : null

  // Determine output method and platforms
  const versionPlatforms = getPlatformsForVersion(version)
  const buildPlatforms = versionPlatforms // Always use full multi-arch for both local and push

  // For local builds, we need to use a single platform since --load doesn't support manifest lists
  const outputFlag = options.push ? '--push' : '--load'
  const localPlatform = options.push ? buildPlatforms : detectLocalArch() // Use detected local architecture for local builds

  if (options.push) {
    log(`Building ${tag} for platforms: ${buildPlatforms} (pushing to registry)`)
  } else {
    log(`Building ${tag} for platform: ${localPlatform} (loading locally)`)
  }

  // Build with all tags in a single command
  let buildTags = `--tag ${tag}`

  // Add minor tag if this is the latest patch for this minor version
  const updateMinor = shouldUpdateMinorTag(version, allVersions)
  if (minorTag && updateMinor) {
    buildTags += ` --tag ${minorTag}`
    log(`Building ${version} → updating minor tag ${minorVersion}`)
  }

  // Add latest tag if this is the highest version overall
  const updateLatest = shouldUpdateLatestTag(version, allVersions)
  if (updateLatest) {
    buildTags += ` --tag ${latestTag}`
    log(`Building ${version} → updating latest tag`)
  }

  const attemptBuild = async (platforms: string): Promise<boolean> => {
    try {
      const buildCommand = `docker buildx build \
        --platform "${platforms}" \
        --build-arg "POCKETBASE_VERSION=${version}" \
        ${buildTags} \
        "${outputFlag}" \
        .`

      execCommand(buildCommand)
      return true
    } catch (err) {
      return false
    }
  }

  // For local builds, use single platform. For push builds, use full multi-arch with fallback
  const platformsToUse = options.push ? buildPlatforms : localPlatform

  // First attempt with selected platforms
  log(`Attempting build with platforms: ${platformsToUse}`)
  if (await attemptBuild(platformsToUse)) {
    success(`Built ${tag}`)

    if (minorTag && updateMinor) {
      success(`Updated minor tag ${minorTag}`)
    }

    if (updateLatest) {
      success(`Updated latest tag`)
    }

    return true
  }

  // If first attempt failed and we're pushing, try with fallback platforms
  if (options.push) {
    const fallbackPlatforms = getFallbackPlatforms()
    if (fallbackPlatforms !== buildPlatforms) {
      warn(`Build failed with ${buildPlatforms}, retrying with fallback platforms: ${fallbackPlatforms}`)
      log(`Attempting build with fallback platforms: ${fallbackPlatforms}`)

      if (await attemptBuild(fallbackPlatforms)) {
        success(`Built ${tag} with fallback platforms`)

        if (minorTag && updateMinor) {
          success(`Updated minor tag ${minorTag}`)
        }

        if (updateLatest) {
          success(`Updated latest tag`)
        }

        return true
      }
    }
  }

  error(`Failed to build ${tag}`)
  warn(`Skipping ${version} and continuing with next version`)
  return false
}

const parseArgs = (): BuildOptions => {
  const program = new Command()

  program
    .name('build.ts')
    .description('Multi-arch Docker build script for PocketBase instances')
    .version('1.0.0')
    .option('-p, --push', 'Push images to registry after building', false)
    .option('-r, --registry <registry>', 'Registry name', REGISTRY)
    .option('-n, --name <name>', 'Image name', IMAGE_NAME)
    .option('-l, --limit <number>', 'Number of most recent versions to build', (value) => parseInt(value, 10), LIMIT)
    .option('--platforms <platforms>', 'Comma-separated list of platforms', PLATFORMS)
    .option('-f, --force', 'Force rebuild all versions, ignoring existing tags', false)
    .option('--versions-file <file>', 'Path to versions JSON file', 'versions.json')
    .addHelpText(
      'after',
      `
Examples:
  # Build missing versions locally (default)
  bun run build.ts

  # Build and push all missing versions
  bun run build.ts --push

  # Build and push up to 10 most recent missing versions
  bun run build.ts --push --limit 10

  # Build all missing versions
  bun run build.ts --limit 0

  # Force rebuild all versions (ignores existing tags)
  bun run build.ts --force

  # Force rebuild and push latest 5 versions
  bun run build.ts --force --push --limit 5

  # Build with custom registry
  bun run build.ts --registry myregistry --push

Note: This script compares versions.json against existing Docker tags
and only builds missing versions. Use --force to rebuild all versions.
It also updates minor version tags (e.g., 0.29) and the 'latest' tag as needed.
`
    )

  program.parse()
  const options = program.opts()

  return {
    push: options.push,
    registry: options.registry,
    name: options.name,
    limit: options.limit,
    platforms: options.platforms,
    force: options.force,
    versionsFile: options.versionsFile,
  }
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

    const allVersions = loadVersions(options.versionsFile)

    let versionsToBuild: string[]

    if (options.force) {
      // Force rebuild: use all versions or limited versions
      log('Force rebuild enabled - ignoring existing tags')
      const sortedVersions = allVersions.sort(semverCompare)
      versionsToBuild = options.limit === 0 ? sortedVersions : sortedVersions.slice(-options.limit)
    } else {
      // Normal mode: check for missing versions
      const existingTags = await fetchExistingDockerTags(options.registry, options.name, options.push)
      const missingVersions = findMissingVersions(allVersions, existingTags)

      if (missingVersions.length === 0) {
        success('All versions are already built! No builds needed.')
        return
      }

      // Sort missing versions by semver and apply limit if specified
      const sortedMissingVersions = missingVersions.sort(semverCompare)
      versionsToBuild = options.limit === 0 ? sortedMissingVersions : sortedMissingVersions.slice(-options.limit)
    }

    log(`Building ${versionsToBuild.length} versions: ${versionsToBuild.join(', ')}`)

    // Build each version
    const successfulBuilds: string[] = []
    for (const version of versionsToBuild) {
      const success = await buildVersion(version, options, allVersions)
      if (success) {
        successfulBuilds.push(version)
      }
    }

    if (successfulBuilds.length > 0) {
      success(
        `Build process completed! ${successfulBuilds.length}/${versionsToBuild.length} versions built successfully.`
      )

      // Show built images and tags in semver order
      log('Successfully built images and updated tags:')
      const sortedSuccessfulBuilds = successfulBuilds.sort(semverCompare)
      for (const version of sortedSuccessfulBuilds) {
        console.log(`  ${options.registry}/${options.name}:${version}`)

        // Show minor tag if it was updated
        const minorVersion = extractMinorVersion(version)
        if (minorVersion && shouldUpdateMinorTag(version, allVersions)) {
          console.log(`  ${options.registry}/${options.name}:${minorVersion} (updated)`)
        }

        // Show latest tag if it was updated
        if (shouldUpdateLatestTag(version, allVersions)) {
          console.log(`  ${options.registry}/${options.name}:latest (updated)`)
        }
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
