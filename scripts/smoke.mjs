// Collaudo automatico dell'app desktop: avvia Electron in un profilo
// temporaneo, simula avvio del tempo e un gol, fotografa le finestre e
// stampa il rapporto. Uso: npm run app:smoke [cartella-uscita]
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'

const out = resolve(process.argv[2] ?? mkdtempSync(join(tmpdir(), 'tabellone-smoke-')))
mkdirSync(out, { recursive: true })
const profile = mkdtempSync(join(tmpdir(), 'tabellone-profilo-'))

const result = spawnSync(electron, ['.', `--user-data-dir=${profile}`], {
  stdio: 'inherit',
  env: { ...process.env, TABELLONE_SMOKE_TEST: out },
  timeout: 90_000,
})
if (result.error) throw result.error

const report = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'))
console.log(JSON.stringify(report, null, 2))
console.log(`\nScreenshot in: ${out}`)
process.exit(report.error ? 1 : 0)
