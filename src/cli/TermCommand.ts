import { Command } from 'commander'
import { spawn } from 'node:child_process'
import { normalizeOptions, pbgo } from '..'
import { config } from './config'

export const TermCommand = () => {
  return new Command(`term`)
    .description('Run in terminal mode')
    .option('-u, --use <version>', 'Run with specific PocketBase version', config.version)
    .option('-r, --runtime <runtime>', 'Select runtime: podman|docker', config.runtime)
    .option('--dir <dir>', 'PocketBase data directory', './pb_data')
    .option('--hooksDir <hooksDir>', 'PocketBase hooks directory', './pb_hooks')
    .option('--publicDir <publicDir>', 'PocketBase public directory', './pb_public')
    .option('--migrationsDir <migrationsDir>', 'PocketBase migrations directory', './pb_migrations')
    .option(`--verbose`, 'Verbose output', false)
    .action(async (options: any) => {
      const pbgoOptions = normalizeOptions({
        ...options,
        isTermMode: true,
        args: [`bash`],
      })

      const pbgoCmd = pbgo(pbgoOptions)
      const child = spawn(pbgoCmd.command, pbgoCmd.args, { stdio: 'inherit', shell: true })
      child.on('exit', (code) => {
        process.exit(code ?? 0)
      })
    })
}
