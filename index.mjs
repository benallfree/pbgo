// Library interface: assemble docker command/args only
/**
 * Assemble the Docker command for running PocketBase.
 * No side effects; callers decide how to execute the command.
 * @param {{ currentDir: string, port?: number, version?: string, dockerArgs?: string[], isSshMode?: boolean }} options
 * @returns {{ command: string, args: string[] }}
 */
function pbgo(options) {
  const { currentDir, port = 8090, version = 'latest', dockerArgs = [], isSshMode = false } = options || {}

  const dockerCommand = 'docker'
  const finalDockerArgs = [
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
    finalDockerArgs.push('bash')
  } else {
    const hasServeCommand = dockerArgs.includes('serve')
    finalDockerArgs.push(
      ...[
        'pocketbase',
        ...dockerArgs,
        hasServeCommand ? (dockerArgs.find((arg) => arg.startsWith('--http')) ? null : '--http="0.0.0.0:8090"') : null,
      ].filter(Boolean)
    )
  }

  return { command: dockerCommand, args: finalDockerArgs }
}

export { pbgo }
