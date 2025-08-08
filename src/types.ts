export type ContainerRuntime = 'docker' | 'podman'

export type Target = string
export type HostPath = string
export interface RunOptions {
  host?: string
  port?: number
  version?: string
  args?: string[]
  isTermMode?: boolean
  binds?: Record<Target, HostPath>
}

export type AssembleOptions = RunOptions

export interface PbgoOptions extends RunOptions {
  runtime?: ContainerRuntime
}

export interface AssembledCommand {
  command: string
  args: string[]
}
