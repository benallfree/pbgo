import { spawnSync } from 'node:child_process'
import type { AssembleOptions } from '../types'

export function assemble(options: AssembleOptions): { command: string; args: string[] } {
  const { currentDir, port = 8090, version = 'latest', args: userArgs = [], isTermMode = false } = options || {}

  const command = 'podman'
  const args = [
    'run',
    '--rm',
    '-it',
    '-v',
    `${currentDir}:/data`,
    '-p',
    `${port}:8090`,
    `benallfree/pocketbase:${version}`,
  ]

  if (isTermMode) {
    args.push('bash')
  } else {
    const hasServeCommand = userArgs.includes('serve')
    args.push(
      ...[
        'pocketbase',
        ...userArgs,
        hasServeCommand ? (userArgs.find((arg) => arg.startsWith('--http')) ? null : '--http="0.0.0.0:8090"') : null,
      ].filter(Boolean) as string[]
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


