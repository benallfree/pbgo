import { Command } from 'commander'
import { config } from './config'

export const UseCommand = () => {
  return new Command(`use`)
    .argument('<version>', 'PocketBase version')
    .description('Set default PocketBase version')
    .action((version) => {
      try {
        config.version = version
        console.log(`Default PocketBase version set to '${version}' in ${config.path}`)
      } catch (error: any) {
        console.error('Error writing .pbgorc:', error.message)
        process.exit(1)
      }
    })
}
