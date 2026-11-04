import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Pagine: console operatore (index.html), tabellone spettatori (display.html)
// e scelta degli schermi all'avvio del programma (setup.html).
export default defineConfig({
  // Percorsi relativi: necessari per caricare i file in Electron (file://).
  base: './',
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        console: resolve(import.meta.dirname, 'index.html'),
        display: resolve(import.meta.dirname, 'display.html'),
        setup: resolve(import.meta.dirname, 'setup.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts'],
    environment: 'node',
  },
})
