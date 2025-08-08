#!/usr/bin/env node

import { spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { pbgo } from './index.mjs'

function getPbgorcPath(baseDir) {
  return path.join(baseDir, '.pbgorc')
}

function readDefaultVersionFromConfig(baseDir) {
  try {
    const configPath = getPbgorcPath(baseDir)
    if (existsSync(configPath)) {
      const contents = readFileSync(configPath, 'utf8').trim()
      if (contents) return contents
    }
  } catch (_) {}
  return null
}

function writeDefaultVersionToConfig(baseDir, version) {
  const configPath = getPbgorcPath(baseDir)
  writeFileSync(configPath, `${version}\n`, 'utf8')
}

async function listDockerHubTags(namespace, repository) {
  let page = 1
  const pageSize = 100
  let allTags = []
  try {
    while (true) {
      const url = `https://registry.hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/tags?page_size=${pageSize}&page=${page}`
      const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
      if (!response.ok) {
        if (response.status === 404) break
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      const data = await response.json()
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

;(async () => {
  const args = process.argv.slice(2)
  const currentDir = process.cwd()
  let version = readDefaultVersionFromConfig(currentDir) || 'latest'
  let port = 8090
  let dockerArgs = []
  let isSshMode = false
  let isVersionsMode = false
  let isUseMode = false
  let useModeVersion = null

  if (args.length > 0 && args[0] === 'term') {
    isSshMode = true
    args.shift()
  }

  if (args.length > 0 && args[0] === 'versions') {
    isVersionsMode = true
    args.shift()
  }

  if (args.length > 0 && args[0] === 'use') {
    isUseMode = true
    args.shift()
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
        i++
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
        i++
      } else {
        console.error('Error: Port flag requires a port value')
        process.exit(1)
      }
    } else {
      dockerArgs.push(arg)
    }
  }

  if (isVersionsMode) {
    console.log('Fetching available PocketBase versions from Docker Hub...')
    const tags = await listDockerHubTags('benallfree', 'pocketbase')
    if (tags.length > 0) {
      console.log('Available PocketBase versions:')
      for (const tag of tags) console.log(`  ${tag}`)
    } else {
      console.log('No versions found or error occurred')
    }
    process.exit(0)
  }

  if (isUseMode) {
    try {
      writeDefaultVersionToConfig(currentDir, useModeVersion)
      console.log(`Default PocketBase version set to '${useModeVersion}' in ${getPbgorcPath(currentDir)}`)
      process.exit(0)
    } catch (error) {
      console.error('Error writing .pbgorc:', error.message)
      process.exit(1)
    }
  }

  const { command, args: dockerArgsFinal } = pbgo({
    currentDir,
    port,
    version,
    dockerArgs,
    isSshMode,
  })

  const child = spawn(command, dockerArgsFinal, { stdio: 'inherit', shell: true })
  child.on('error', (error) => {
    console.error('Error running PocketBase:', error.message)
    process.exit(1)
  })
  child.on('exit', (code) => {
    process.exit(code)
  })
})()
