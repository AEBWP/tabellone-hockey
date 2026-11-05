// Copia su Dropbox l'installer di una release definitiva e tiene solo le
// ultime 5 (le più vecchie vanno nei "File eliminati" di Dropbox, recuperabili).
//
// Uso:  npm run dropbox:carica                 (versione di package.json)
//       npm run dropbox:carica -- 0.9.6        (una versione precisa)
//       npm run dropbox:carica -- --prova      (mostra cosa farebbe, senza cambiare nulla)
//
// Carica solo installer di release già pubblicate su GitHub (non bozze né
// pre-release) e identici al file allegato alla release: mai le build di prova.
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  CONFIG_FILE,
  DROPBOX_FOLDER,
  SHOWN_FOLDER,
  KEEP,
  connect,
  dropboxContentHash,
  installersToPrune,
  readConfig,
  sortInstallers,
} from './dropbox-lib.mjs'

// Errori (rete, accesso negato…): messaggio chiaro invece dello stack tecnico.
process.on('uncaughtException', (e) => {
  console.error(`\n✖ ${e.message}`)
  process.exit(1)
})

const root = path.join(import.meta.dirname, '..')
const args = process.argv.slice(2)
const dryRun = args.includes('--prova')
const version =
  args.find((a) => /^\d+\.\d+\.\d+$/.test(a)) ??
  JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version

const fileName = `Tabellone-Hockey-${version}-installazione.exe`
const filePath = path.join(root, 'release', fileName)
const fail = (msg) => {
  console.error(`\n✖ ${msg}`)
  process.exit(1)
}

const cfg = readConfig()
if (!cfg) fail(`Dropbox non è collegato su questo PC: esegui prima "npm run dropbox:collega".`)

// 1) Il file esiste ed è quello della release pubblicata su GitHub
let size
try {
  size = statSync(filePath).size
} catch {
  fail(`Non trovo ${filePath}: crea prima l'installer con "npm run dist".`)
}

let release
try {
  release = JSON.parse(
    execFileSync(
      'gh',
      ['release', 'view', `v${version}`, '--json', 'isDraft,isPrerelease,assets'],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ),
  )
} catch {
  fail(`La release v${version} non esiste su GitHub: su Dropbox vanno solo le release pubblicate.`)
}
if (release.isDraft || release.isPrerelease) {
  fail(`La release v${version} è una bozza o pre-release: non la carico.`)
}
const asset = release.assets.find((a) => a.name === fileName)
if (!asset) fail(`La release v${version} su GitHub non contiene ${fileName}.`)
if (asset.size !== size) {
  fail(`Il file locale (${size} byte) è diverso da quello della release (${asset.size} byte).`)
}

const data = readFileSync(filePath)
const localHash = dropboxContentHash(data)
const target = `${DROPBOX_FOLDER}/${fileName}`
console.log(
  `Release v${version} · ${(size / 1024 / 1024).toFixed(1)} MB → Dropbox ${SHOWN_FOLDER}/${fileName}`,
)

const dbx = await connect(cfg)

// 2) Caricamento a blocchi (più affidabile per file grandi)
const existing = await dbx.rpc('files/get_metadata', { path: target }).catch(() => null)
if (existing?.content_hash === localHash) {
  console.log('✔ Già presente su Dropbox e identico: non lo ricarico.')
} else if (dryRun) {
  console.log('(prova) Caricherei il file.')
} else {
  const CHUNK = 8 * 1024 * 1024
  const { session_id } = await dbx.content(
    'files/upload_session/start',
    { close: false },
    data.subarray(0, CHUNK),
  )
  let offset = Math.min(CHUNK, size)
  while (offset < size) {
    const next = Math.min(offset + CHUNK, size)
    await dbx.content(
      'files/upload_session/append_v2',
      { cursor: { session_id, offset }, close: false },
      data.subarray(offset, next),
    )
    offset = next
    process.stdout.write(`\r  caricati ${Math.round((offset / size) * 100)}%   `)
  }
  const uploaded = await dbx.content(
    'files/upload_session/finish',
    {
      cursor: { session_id, offset: size },
      commit: { path: target, mode: 'overwrite', autorename: false, mute: true },
    },
    new Uint8Array(0),
  )
  console.log('')
  if (uploaded.content_hash !== localHash) {
    fail('Il file su Dropbox non corrisponde a quello locale: riprova.')
  }
  console.log(`✔ Caricato e verificato in ${SHOWN_FOLDER}/${uploaded.name}`)
}

// 3) Tieni solo le ultime KEEP release
const names = []
let page = await dbx.rpc('files/list_folder', { path: DROPBOX_FOLDER, recursive: false })
for (;;) {
  names.push(...page.entries.filter((e) => e['.tag'] === 'file').map((e) => e.name))
  if (!page.has_more) break
  page = await dbx.rpc('files/list_folder/continue', { cursor: page.cursor })
}
if (dryRun && !names.includes(fileName)) names.push(fileName)

const toDelete = installersToPrune(names, KEEP)
for (const name of toDelete) {
  if (dryRun) {
    console.log(`(prova) Eliminerei ${name}`)
    continue
  }
  await dbx.rpc('files/delete_v2', { path: `${DROPBOX_FOLDER}/${name}` })
  console.log(
    `✔ Eliminata la versione vecchia ${name} (recuperabile dai File eliminati di Dropbox)`,
  )
}

const kept = sortInstallers(names).filter((n) => !toDelete.includes(n))
console.log(`\nSu Dropbox ora: ${kept.join(', ') || '—'}`)
console.log(`(credenziali in ${CONFIG_FILE})`)
