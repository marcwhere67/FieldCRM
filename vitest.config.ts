import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    // Mirror the tsconfig "@/*" -> "src/*" path alias so tests can import it.
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
