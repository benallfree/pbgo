#!/usr/bin/env node

import { spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

function getPbcrcPath(baseDir) {
  return path.join(baseDir, '.pbcrc')
}

function readDefaultVersionFromConfig(baseDir) {
  try {
    const configPath = getPbcrcPath(baseDir)
    if (existsSync(configPath)) {
      const contents = readFileSync(configPath, 'utf8').trim()
      if (contents) return contents
    }
  } catch (_) {}
  return null
}

function writeDefaultVersionToConfig(baseDir, version) {
  const configPath = getPbcrcPath(baseDir)
  writeFileSync(configPath, `${version}\n`, 'utf8')
}

function parseArgs() {
  const args = process.argv.slice(2)
  const currentDir = process.cwd()
  let version = readDefaultVersionFromConfig(currentDir) || 'latest'
  let port = 8090
  let dockerArgs = []
  let isSshMode = false
  let isVersionsMode = false
  let isUseMode = false
  let useModeVersion = null

  // Check if first argument is 'term'
  if (args.length > 0 && args[0] === 'term') {
    isSshMode = true
    args.shift() // Remove 'term' from args
  }

  // Check if first argument is 'versions'
  if (args.length > 0 && args[0] === 'versions') {
    isVersionsMode = true
    args.shift() // Remove 'versions' from args
  }

  // Check if first argument is 'use'
  if (args.length > 0 && args[0] === 'use') {
    isUseMode = true
    args.shift() // Remove 'use' from args
    if (args.length > 0) {
      useModeVersion = args.shift()
    } else {
      console.error('Error: pbgo use <version> requires a version value')
      process.exit(1)
    }
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--use') {
      if (i + 1 < args.length) {
        version = args[i + 1]
        i++ // Skip the next argument since we consumed it
      } else {
        console.error('Error: --use flag requires a version value')
        process.exit(1)
      }
    } else if (arg === '-p' || arg === '--port') {
      if (i + 1 < args.length) {
        const portValue = parseInt(args[i + 1])
        if (isNaN(portValue) || portValue < 1 || portValue > 65535) {
          console.error('Error: Port must be a valid number between 1 and 65535')
          process.exit(1)
        }
        port = portValue
        i++ // Skip the next argument since we consumed it
      } else {
        console.error('Error: Port flag requires a port value')
        process.exit(1)
      }
    } else {
      dockerArgs.push(arg)
    }
  }

  return { version, port, dockerArgs, isSshMode, isVersionsMode, isUseMode, useModeVersion, currentDir }
}

function runPocketBase() {
  const { version, port, dockerArgs, isSshMode, isVersionsMode, isUseMode, useModeVersion, currentDir } = parseArgs()

  // Handle versions command
  if (isVersionsMode) {
    console.log('Fetching available PocketBase versions from Docker Hub...')

    async function listDockerHubTags(namespace, repository) {
      let page = 1
      const pageSize = 100 // Max allowed by Docker Hub
      let allTags = []

      try {
        while (true) {
          const url = `https://registry.hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/tags?page_size=${pageSize}&page=${page}`
          const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } })

          if (!response.ok) {
            if (response.status === 404) {
              break // No more pages
            }
            throw new Error(`HTTP error! Status: ${response.status}`)
          }

          const data = await response.json()
          if (!data.results || data.results.length === 0) {
            break // No more tags
          }

          const tags = data.results.map((tag) => tag.name)
          allTags = allTags.concat(tags)
          page++
        }

        return allTags
      } catch (error) {
        console.error('Error fetching tags:', error.message)
        return []
      }
    }

    // List tags for benallfree/pocketbase
    listDockerHubTags('benallfree', 'pocketbase').then((tags) => {
      if (tags.length > 0) {
        console.log('Available PocketBase versions:')
        tags.forEach((tag) => console.log(`  ${tag}`))
      } else {
        console.log('No versions found or error occurred')
      }
    })
    return
  }

  // Handle use command (write .pbcrc with desired tag)
  if (isUseMode) {
    try {
      writeDefaultVersionToConfig(currentDir, useModeVersion)
      console.log(`Default PocketBase version set to '${useModeVersion}' in ${getPbcrcPath(currentDir)}`)
      return
    } catch (error) {
      console.error('Error writing .pbcrc:', error.message)
      process.exit(1)
    }
  }

  const dockerCommand = 'docker'
  const finalDockerArgs = [
    'run',
    '--rm',
    '-it',
    '-v',
    `${currentDir}:/data`,
    '-p',
    `${port}:8090`,
    `benallfree/pocketbase:${version}`,
  ]

  if (isSshMode) {
    // For SSH mode, run bash instead of pocketbase
    finalDockerArgs.push('bash')
  } else {
    // For normal mode, run pocketbase with any additional args
    const hasServeCommand = dockerArgs.includes('serve')

    finalDockerArgs.push(
      ...[
        'pocketbase',
        ...dockerArgs,
        hasServeCommand ? (dockerArgs.find((arg) => arg.startsWith('--http')) ? null : '--http="0.0.0.0:8090"') : null,
      ].filter(Boolean)
    )
  }

  const modeText = isSshMode ? 'Terminal session' : 'PocketBase'
  console.log(`Running ${modeText} ${version} on port ${port} with data directory: ${currentDir}`)

  const child = spawn(dockerCommand, finalDockerArgs, {
    stdio: 'inherit',
    shell: true,
  })

  child.on('error', (error) => {
    console.error(`Error running ${modeText}:`, error.message)
    process.exit(1)
  })

  child.on('exit', (code) => {
    process.exit(code)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPocketBase()
}
