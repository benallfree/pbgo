#!/usr/bin/env bun

import { Command } from 'commander'
import { readFileSync, writeFileSync } from 'fs'
import { major, minor, patch, compare as semverCompare, valid } from 'semver'

// Colors for output
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const NC = '\x1b[0m'

interface GitHubRelease {
  tag_name: string
  prerelease: boolean
}

interface VersionInfo {
  major: number
  minor: number
  patch: number
  version: string
  sortKey: number
}

const log = (message: string) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19)
  console.log(`${BLUE}[${timestamp}]${NC} ${message}`)
}

const success = (message: string) => {
  console.log(`${GREEN}[SUCCESS]${NC} ${message}`)
}

const warn = (message: string) => {
  console.log(`${YELLOW}[WARNING]${NC} ${message}`)
}

const fetchGitHubReleases = async (): Promise<string[]> => {
  log('Fetching PocketBase releases from GitHub...')

  const versions: string[] = []
  let page = 1

  while (true) {
    log(`Fetching page ${page}...`)

    try {
      const response = await fetch(
        `https://api.github.com/repos/pocketbase/pocketbase/releases?per_page=100&page=${page}`
      )

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`)
      }

      const releases: GitHubRelease[] = await response.json()

      // Stop if we got no results
      if (releases.length === 0) {
        log('No more releases found. Finished fetching all pages.')
        break
      }

      // Filter out prereleases and extract version numbers
      const pageVersions = releases
        .filter((release) => !release.prerelease)
        .map((release) => release.tag_name.replace(/^v/, ''))

      versions.push(...pageVersions)
      page++
    } catch (error) {
      warn(`Error fetching page ${page}: ${error}`)
      break
    }
  }

  return versions
}

const parseVersion = (version: string): VersionInfo | null => {
  if (!valid(version)) return null

  return {
    major: major(version),
    minor: minor(version),
    patch: patch(version),
    version,
    sortKey: major(version) * 10000 + minor(version) * 100 + patch(version),
  }
}

const filterLatestPatches = (versions: string[]): string[] => {
  log('Filtering to latest patch release of each minor version...')

  const versionMap = new Map<string, VersionInfo>()

  for (const version of versions) {
    const versionInfo = parseVersion(version)
    if (!versionInfo) continue

    const minorKey = `${versionInfo.major}.${versionInfo.minor}`
    const existing = versionMap.get(minorKey)

    if (!existing || versionInfo.patch > existing.patch) {
      versionMap.set(minorKey, versionInfo)
    }
  }

  // Sort by version number (descending)
  return Array.from(versionMap.values())
    .sort((a, b) => semverCompare(b.version, a.version))
    .map((v) => v.version)
}

const updateVersionsFile = (versions: string[]) => {
  log('Updating versions.json with new versions...')

  // Show old versions before updating
  try {
    const currentContent = readFileSync('versions.json', 'utf8')
    const versionMatches = currentContent.match(/"([^"]+)"/g)
    if (versionMatches) {
      log('Current versions in versions.json:')
      versionMatches.slice(0, 10).forEach((match) => {
        console.log(`  ${match.replace(/"/g, '')}`)
      })
    }
  } catch (error) {
    // File doesn't exist or can't be read
  }

  const content = JSON.stringify(versions, null, 2)

  writeFileSync('versions.json', content)

  success(`Updated versions.json with ${versions.length} latest PocketBase versions`)

  // Show new versions
  log('New versions (showing first 10):')
  versions.slice(0, 10).forEach((version) => {
    console.log(`  ${version}`)
  })

  if (versions.length > 10) {
    console.log(`  ... and ${versions.length - 10} more`)
  }
}

const parseArgs = () => {
  const program = new Command()

  program
    .name('update-versions.ts')
    .description('Update versions.json with latest PocketBase releases from GitHub')
    .version('1.0.0')
    .option('-v, --verbose', 'Show detailed output including all found versions', false)
    .addHelpText(
      'after',
      `
Examples:
  # Update versions.json with latest releases
  bun run update-versions.ts

  # Show detailed output with all found versions
  bun run update-versions.ts --verbose
`
    )

  program.parse()
  return program.opts()
}

const main = async () => {
  try {
    const options = parseArgs()

    const versions = await fetchGitHubReleases()

    if (versions.length === 0) {
      warn('Could not fetch versions from GitHub. Please check your internet connection.')
      process.exit(1)
    }

    log(`Total versions found: ${versions.length}`)

    if (options.verbose) {
      log('All versions found:')
      versions.slice(0, 20).forEach((version) => {
        console.log(`  ${version}`)
      })
      if (versions.length > 20) {
        console.log(`  ... (and ${versions.length - 20} more)`)
      }
    }

    const filteredVersions = filterLatestPatches(versions)

    log(`Filtered to ${filteredVersions.length} versions (latest patch per minor version):`)
    filteredVersions.forEach((version) => {
      console.log(`  ${version}`)
    })

    updateVersionsFile(filteredVersions)

    log('Run "bun run build.ts --push" to build images with the updated versions')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
