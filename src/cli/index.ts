#!/usr/bin/env node

import { Command } from 'commander'
import { PocketBaseCommand } from './PocketBaseCommand'
import { TermCommand } from './TermCommand'
import { UseCommand } from './UseCommand'
import { VersionsCommand } from './VersionsCommand'

const program = new Command(`pbgo`)
  .addCommand(TermCommand())
  .addCommand(UseCommand())
  .addCommand(VersionsCommand())
  .addCommand(PocketBaseCommand(), { isDefault: true })

;(async () => {
  await program.parseAsync()
})()
