import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'))

// Pagine: console operatore (index.html), tabellone spettatori (display.html)
// e scelta degli schermi all'avvio del programma (setup.html).
export default defineConfig({
  // Percorsi relativi: necessari per caricare i file in Electron (file://).
  base: './',
  plugins: [svelte()],
  // Numero di versione mostrato nella console (preso da package.json).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
})
