import { assemble as assembleWithDocker } from './providers/docker'
import { assemble as assembleWithPodman } from './providers/podman'

export type ContainerRuntime = 'docker' | 'podman'

export interface PbgoOptions {
  currentDir: string
  port?: number
  version?: string
  dockerArgs?: string[]
  isSshMode?: boolean
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
    dockerArgs = [],
    isSshMode = false,
    runtime = 'docker',
  } = options || ({} as PbgoOptions)

  const assemble = runtime === 'podman' ? assembleWithPodman : assembleWithDocker
  return assemble({ currentDir, port, version, dockerArgs, isSshMode })
}

export { pbgo }


