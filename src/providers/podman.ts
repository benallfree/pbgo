import { spawnSync } from 'node:child_process'
import type { AssembleOptions } from '../types'

export function assemble(options: AssembleOptions): { command: string; args: string[] } {
  const {
    host = '0.0.0.0',
    port = 8090,
    version = 'latest',
    args: userArgs = [],
    isTermMode = false,
    binds = {},
  } = options || {}

  const command = 'podman'
  const args = ['run', '--rm', '-it', '-p', `${host}:${port}:8090`, `benallfree/pocketbase:${version}`]

  // Layer additional bind mounts
  for (const [key, hostPath] of Object.entries(binds)) {
    if (!hostPath) continue
    const containerPath = `/data/${key}`
    args.splice(args.length - 1, 0, '-v', `${hostPath}:${containerPath}`)
  }

  if (isTermMode) {
    args.push('bash')
  } else {
    const hasServeCommand = userArgs.includes('serve')
    args.push(
      ...([
        'pocketbase',
        ...userArgs,
        hasServeCommand ? (userArgs.find((arg) => arg.startsWith('--http')) ? null : '--http="0.0.0.0:8090"') : null,
      ].filter(Boolean) as string[])
    )
  }

  return { command, args }
}

export function check(): boolean {
  try {
    const result = spawnSync('podman', ['--version'], { stdio: 'ignore' })
    return !result.error && result.status === 0
  } catch (_) {
    return false
  }
}
