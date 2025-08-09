export type ContainerRuntime = 'docker' | 'podman'

export type TargetPath = string
export type HostPath = string
export type OsiTag = string
export type FilePath = string

export type Binds = Record<TargetPath, HostPath>
export interface PbgoOptions {
  use: OsiTag
  host: string
  port: number
  args: string[]
  isTermMode: boolean
  binds: Binds
  runtime: ContainerRuntime
  dir: FilePath
  hooksDir: FilePath
  publicDir: FilePath
  migrationsDir: FilePath
  verbose: boolean
}
