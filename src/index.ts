import { assemble as assembleWithDocker } from './providers/docker'
import { assemble as assembleWithPodman } from './providers/podman'
import type { AssembledCommand, AssembleOptions, PbgoOptions } from './types'

export function pbgo(options: PbgoOptions): AssembledCommand {
  const {
    host = '0.0.0.0',
    port = 8090,
    version = 'latest',
    args = [],
    isTermMode = false,
    runtime = 'docker',
    binds = {},
  } = options || ({} as PbgoOptions)

  const assemble = runtime === 'podman' ? assembleWithPodman : assembleWithDocker
  return assemble({ host, port, version, args, isTermMode, binds })
}

export type { AssembledCommand, AssembleOptions, PbgoOptions }
