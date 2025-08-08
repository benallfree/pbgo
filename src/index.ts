import type { AssembledCommand, AssembleOptions, PbgoOptions } from './types'

function assemble(command: string, options: AssembleOptions): AssembledCommand {
  const {
    host = '0.0.0.0',
    port = 8090,
    version = 'latest',
    args: userArgs = [],
    isTermMode = false,
    binds = {},
  } = options || {}

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
      ...(['pocketbase', ...userArgs, hasServeCommand ? '--http="0.0.0.0:8090"' : null].filter(Boolean) as string[])
    )
  }

  return { command, args }
}

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

  return assemble(runtime, { host, port, version, args, isTermMode, binds })
}

export type { AssembledCommand, AssembleOptions, PbgoOptions }
