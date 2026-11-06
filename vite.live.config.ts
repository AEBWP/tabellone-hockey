import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'))

// Pagina per gli spettatori dello streaming (src/live), pubblicata con il
// servizio online in server/ (npm run live:build, npm run live:deploy).
export default defineConfig({
  root: resolve(import.meta.dirname, 'src/live'),
  // Indirizzi assoluti: la pagina si apre da /<nome-palaghiaccio>.
  base: '/',
  publicDir: false,
  plugins: [svelte({ configFile: resolve(import.meta.dirname, 'svelte.config.js') })],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { fs: { allow: [import.meta.dirname] } },
  build: {
    outDir: resolve(import.meta.dirname, 'server/public'),
    emptyOutDir: true,
  },
})
