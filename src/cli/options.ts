import { Option } from 'commander'
import { resolve } from 'node:path'
import { Binds } from '../types'

export const BindOption = () =>
  new Option('-b, --binds <bind>', 'Bind a directory to a path in the container')
    .argParser<Binds>((value, previous) => {
      const [host, target] = value.trim().startsWith('=') ? value.trim().slice(1).split(':') : value.trim().split(':')
      if (!target || !host) {
        throw new Error('Invalid bind format. Expected format: <target>:<host>')
      }
      previous[target] = resolve(host)
      return previous
    })
    .default({} as Binds)
