// Funzioni comuni per caricare le release su Dropbox (vedi dropbox-collega.mjs
// e dropbox-carica.mjs). Usa solo l'API HTTP di Dropbox: nessuna dipendenza.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * L'app Dropbox ha accesso solo alla sua cartella ("cartella dell'applicazione"),
 * che si chiama come l'app: per l'API è la radice ''. Dentro Dropbox la si
 * vede come /Applicazioni/Tabellone Hockey.
 */
export const DROPBOX_FOLDER = ''
/** Dove si trova la cartella vista dal sito o dall'app di Dropbox (solo per i messaggi). */
export const SHOWN_FOLDER = '/Applicazioni/Tabellone Hockey'
/** Quante release tenere su Dropbox. */
export const KEEP = 5
/** Nome dei file di installazione: Tabellone-Hockey-<versione>-installazione.exe */
export const INSTALLER_RE = /^Tabellone-Hockey-(\d+)\.(\d+)\.(\d+)-installazione\.exe$/

/**
 * Le credenziali stanno fuori dal progetto (mai su GitHub), nella cartella
 * dell'utente Windows. La chiave dell'app non è segreta (accesso PKCE);
 * il token di rinnovo sì: non condividere questo file.
 */
export const CONFIG_FILE = path.join(
  process.env.APPDATA ?? path.join(os.homedir(), '.config'),
  'tabellone-hockey-release',
  'dropbox.json',
)

export function readConfig() {
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
    if (cfg.appKey && cfg.refreshToken) return cfg
  } catch {
    // assente o illeggibile
  }
  return null
}

export function writeConfig(cfg) {
  mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 })
}

/** Intestazione Dropbox-API-Arg: JSON con i caratteri non ASCII in forma \uXXXX. */
export function apiArg(value) {
  return JSON.stringify(value).replace(
    /[^\x20-\x7e]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  )
}

/**
 * "Content hash" di Dropbox: SHA-256 della concatenazione degli SHA-256 dei
 * blocchi da 4 MB. Serve a verificare che il file caricato sia identico.
 */
export function dropboxContentHash(buffer) {
  const BLOCK = 4 * 1024 * 1024
  const blocks = []
  for (let i = 0; i < buffer.length; i += BLOCK) {
    blocks.push(
      createHash('sha256')
        .update(buffer.subarray(i, i + BLOCK))
        .digest(),
    )
  }
  return createHash('sha256').update(Buffer.concat(blocks)).digest('hex')
}

/** Versione [maggiore, minore, patch] dal nome del file, o null se non è un installer. */
export function installerVersion(name) {
  const m = INSTALLER_RE.exec(name)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** Solo gli installer, dal più recente al più vecchio (per numero di versione). */
export function sortInstallers(names) {
  return names
    .map((name) => ({ name, v: installerVersion(name) }))
    .filter((x) => x.v)
    .sort((a, b) => b.v[0] - a.v[0] || b.v[1] - a.v[1] || b.v[2] - a.v[2])
    .map((x) => x.name)
}

/** Installer da eliminare per tenerne solo `keep`, i più recenti. Gli altri file non si toccano. */
export function installersToPrune(names, keep = KEEP) {
  return sortInstallers(names).slice(keep)
}

export async function tokenRequest(params) {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Dropbox ha rifiutato l'accesso: ${body.error_description ?? res.status}`)
  }
  return body
}

/** Client minimale per l'API di Dropbox, con token di accesso rinnovato dalla configurazione. */
export async function connect(cfg) {
  const { access_token: token } = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: cfg.refreshToken,
    client_id: cfg.appKey,
  })

  async function rpc(endpoint, args) {
    const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`Dropbox ${endpoint}: ${res.status} ${text}`)
    return text ? JSON.parse(text) : null
  }

  async function content(endpoint, args, data) {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    }
    if (args !== undefined) headers['Dropbox-API-Arg'] = apiArg(args)
    const res = await fetch(`https://content.dropboxapi.com/2/${endpoint}`, {
      method: 'POST',
      headers,
      body: data,
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`Dropbox ${endpoint}: ${res.status} ${text}`)
    return text ? JSON.parse(text) : null
  }

  return { rpc, content }
}
