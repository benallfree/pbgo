import { spawnSync } from 'node:child_process'

export function checkContainerRuntimeAvailable(cmd: string): boolean {
  try {
    const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' })
    return !result.error && result.status === 0
  } catch {
    return false
  }
}

export function checkDocker(): boolean {
  return checkContainerRuntimeAvailable('docker')
}

export function checkPodman(): boolean {
  return checkContainerRuntimeAvailable('podman')
}

export function detectContainerRuntime() {
  if (checkPodman()) return 'podman'
  if (checkDocker()) return 'docker'
  throw new Error('No container runtime available (docker or podman)')
}
