export type ContainerRuntime = 'docker' | 'podman'

export type Target = string
export type HostPath = string
export type OsiTag = string
export type FilePath = string
export interface PbgoOptions {
  use: OsiTag
  host: string
  port: number
  args: string[]
  isTermMode: boolean
  binds: Record<Target, HostPath>
  runtime: ContainerRuntime
  dir: FilePath
  hooksDir: FilePath
  publicDir: FilePath
  migrationsDir: FilePath
  verbose: boolean
}
