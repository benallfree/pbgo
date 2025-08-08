import { spawnSync } from 'node:child_process'

export interface AssembleOptions {
  currentDir: string
  port?: number
  version?: string
  dockerArgs?: string[]
  isSshMode?: boolean
}

export function assemble(options: AssembleOptions): { command: string; args: string[] } {
  const { currentDir, port = 8090, version = 'latest', dockerArgs = [], isSshMode = false } = options || {}

  const command = 'docker'
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

  if (isSshMode) {
    args.push('bash')
  } else {
    const hasServeCommand = dockerArgs.includes('serve')
    args.push(
      ...[
        'pocketbase',
        ...dockerArgs,
        hasServeCommand ? (dockerArgs.find((arg) => arg.startsWith('--http')) ? null : '--http="0.0.0.0:8090"') : null,
      ].filter(Boolean) as string[]
    )
  }

  return { command, args }
}

export function check(): boolean {
  try {
    const result = spawnSync('docker', ['--version'], { stdio: 'ignore' })
    return !result.error && result.status === 0
  } catch (_) {
    return false
  }
}


