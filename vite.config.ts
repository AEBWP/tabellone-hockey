import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Due pagine: la console operatore (index.html) e il tabellone spettatori (display.html).
export default defineConfig({
  // Percorsi relativi: necessari per caricare i file in Electron (file://).
  base: './',
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        console: resolve(import.meta.dirname, 'index.html'),
        display: resolve(import.meta.dirname, 'display.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
