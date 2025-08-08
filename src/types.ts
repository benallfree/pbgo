export type ContainerRuntime = 'docker' | 'podman'

export interface RunOptions {
  currentDir: string
  port?: number
  version?: string
  args?: string[]
  isTermMode?: boolean
}

export type AssembleOptions = RunOptions

export interface PbgoOptions extends RunOptions {
  runtime?: ContainerRuntime
}

export interface AssembledCommand {
  command: string
  args: string[]
}
