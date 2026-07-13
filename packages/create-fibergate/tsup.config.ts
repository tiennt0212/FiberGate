import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts', 'src/generate-local-env.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
