import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  clean: true,
  unbundle: true,
})
