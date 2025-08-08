import { Command } from 'commander'
import { spawn } from 'node:child_process'
import { normalizeOptions, pbgo } from '..'
import { config } from './config'

export const TermCommand = () => {
  return new Command(`term`)
    .description('Run in terminal mode')
    .argument('[args...]', 'Arguments to pass to PocketBase')
    .option(`-r, --runtime <runtime>`, 'Select runtime: podman|docker', config.runtime)
    .action(async (args: string[], options: any) => {
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
