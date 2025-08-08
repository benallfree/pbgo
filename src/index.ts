import { assemble as assembleWithDocker } from './providers/docker'
import { assemble as assembleWithPodman } from './providers/podman'
import type { AssembleOptions } from './types'

export type ContainerRuntime = 'docker' | 'podman'

export interface PbgoOptions {
  currentDir: string
  port?: number
  version?: string
  args?: string[]
  isTermMode?: boolean
  runtime?: ContainerRuntime
}

export interface AssembledCommand {
  command: string
  args: string[]
}

export function pbgo(options: PbgoOptions): AssembledCommand {
  const {
    currentDir,
    port = 8090,
    version = 'latest',
    args = [],
    isTermMode = false,
    runtime = 'docker',
  } = options || ({} as PbgoOptions)

  const assemble = runtime === 'podman' ? assembleWithPodman : assembleWithDocker
  return assemble({ currentDir, port, version, args, isTermMode } as AssembleOptions)
}
