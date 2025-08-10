import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { detectContainerRuntime } from '../detect'

export type Pbgorc = {
  version: string
  runtime: 'podman' | 'docker'
}

export const config = (() => {
  const configPath = path.join(process.cwd(), '.pbgorc')

  const _config: Pbgorc = {
    version: 'latest',
    runtime: detectContainerRuntime(),
  }

  if (existsSync(configPath)) {
    const contents = readFileSync(configPath, 'utf8').trim()
    if (contents) {
      try {
        const parsed = JSON.parse(contents) as Pbgorc
        if (parsed.version) _config.version = parsed.version
        if (parsed.runtime) _config.runtime = parsed.runtime
      } catch (error) {
        console.error('Error parsing .pbgorc:', error)
      }
    }
  }

  const save = () => {
    writeFileSync(configPath, JSON.stringify(_config, null, 2), 'utf8')
  }

  return {
    get path() {
      return configPath
    },
    get version() {
      return _config.version
    },
    get runtime() {
      return _config.runtime
    },
    set version(version: string) {
      _config.version = version
      save()
    },
    set runtime(runtime: 'podman' | 'docker') {
      _config.runtime = runtime
      save()
    },
  }
})()
