import { assemble as assembleWithDocker } from './providers/docker'
import { assemble as assembleWithPodman } from './providers/podman'
import type { AssembledCommand, AssembleOptions, PbgoOptions } from './types'

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

export type { AssembledCommand, AssembleOptions, PbgoOptions }
