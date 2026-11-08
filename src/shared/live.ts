/**
 * Streaming del tabellone su internet: regole comuni a console, servizio
 * online (cartella `server/`) e pagina per gli spettatori.
 *
 * ⚠️ Compatibilità: il servizio online viene aggiornato a ogni release, ma nei
 * palaghiacci possono restare installate console più vecchie. Questo
 * protocollo può solo **crescere**: campi nuovi facoltativi, mai rinominati o
 * tolti; chi riceve deve accettare campi mancanti o sconosciuti e usare valori
 * predefiniti. Un cambiamento incompatibile va prima discusso (e richiede un
 * nuovo numero di protocollo, mantenendo anche il vecchio).
 */

import type { GameState, Language } from '../engine/types'

/** Versione del protocollo console → servizio. */
export const LIVE_PROTOCOL = 1

/** Servizio online predefinito (si può cambiare nelle impostazioni avanzate). */
export const LIVE_DEFAULT_SERVICE = 'https://live.tabellone-hockey.workers.dev'

/** La console invia la situazione almeno ogni tanto, anche se non cambia nulla. */
export const LIVE_HEARTBEAT_MS = 20_000
/** Oltre questo silenzio la pagina avvisa che il collegamento col palaghiaccio è interrotto. */
export const LIVE_STALE_MS = 65_000

/** Limiti di dimensione (il servizio rifiuta dati più grandi). */
export const LIVE_MAX_STATE_BYTES = 512 * 1024
export const LIVE_MAX_LOGO_BYTES = 1024 * 1024

/** Nomi riservati: sono percorsi del sito, non palaghiacci. */
const RESERVED = new Set(['api', 'assets', 'index', 'favicon', 'robots', 'admin', 'www', 'live'])

/** Nome valido: 3-40 caratteri, lettere minuscole, cifre e trattini (non all'inizio o alla fine). */
export function isValidLiveName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(name) && !RESERVED.has(name)
}

/** Trasforma un testo libero in un nome per il link: "Palaghiaccio Città 2" → "palaghiaccio-citta-2". */
export function toLiveName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

/** Indirizzo pubblico dello streaming. */
export function liveLink(service: string, name: string): string {
  return `${service.replace(/\/+$/, '')}/${name}`
}

/** Impronta breve di un logo, per non rimandarlo a ogni aggiornamento. */
export function logoHash(dataUrl: string): string {
  // FNV-1a a 2 × 32 bit: basta per distinguere i loghi, non serve sicurezza.
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < dataUrl.length; i++) {
    const c = dataUrl.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193)
    b = Math.imul(b ^ c, 0x5bd1e995)
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0')
}

/** Situazione inviata dalla console: lo stato della partita con i loghi sostituiti dalla loro impronta. */
export interface LiveUpdate {
  protocol: number
  /** Versione del programma che invia (es. "0.9.8"). */
  appVersion?: string
  /** Orologio della console al momento dell'invio (ms, stesso riferimento dello stato). */
  sentAt: number
  /** Stato della partita senza loghi (`teams.*.logo` è un'impronta o null). */
  state: GameState
  /**
   * Lingua iniziale per chi apre il link, scelta nella console (dalla 1.0.2).
   * Le console più vecchie non la mandano: la pagina usa allora la lingua del browser.
   */
  viewerLanguage?: Language
}

/** Messaggi dal servizio agli spettatori (WebSocket). */
export type LiveMessage =
  | {
      type: 'status'
      serverNow: number
      /** Il nome è registrato da un palaghiaccio. */
      claimed: boolean
      live: boolean
      /** Ultimo contatto dalla console (ms del servizio), 0 se mai. */
      lastSeen: number
    }
  | {
      type: 'state'
      serverNow: number
      lastSeen: number
      /** Orologio della console meno orologio del servizio, al momento della ricezione. */
      clockOffset: number
      update: LiveUpdate
    }
  | { type: 'logo'; hash: string; data: string }

/** Sostituisce i loghi con la loro impronta; restituisce anche i loghi da inviare. */
export function splitLogos(state: GameState): {
  state: GameState
  logos: Record<string, string>
} {
  const logos: Record<string, string> = {}
  const teams = { ...state.teams }
  for (const id of ['home', 'away'] as const) {
    const logo = state.teams[id].logo
    if (logo) {
      const hash = logoHash(logo)
      logos[hash] = logo
      teams[id] = { ...state.teams[id], logo: hash }
    }
  }
  return { state: { ...state, teams }, logos }
}

/** Rimette i loghi al posto delle impronte (null se il logo non è ancora arrivato). */
export function joinLogos(state: GameState, logos: ReadonlyMap<string, string>): GameState {
  const teams = { ...state.teams }
  for (const id of ['home', 'away'] as const) {
    const ref = state.teams[id]?.logo
    teams[id] = { ...state.teams[id], logo: ref ? (logos.get(ref) ?? null) : null }
  }
  return { ...state, teams }
}

// ── Chiavi dei nomi registrati ──────────────────────────────────────────

/** Un nome registrato da questa console con la sua chiave segreta. */
export interface StreamingKey {
  /** Servizio online del nome (senza "/" finale). */
  service: string
  name: string
  key: string
  /** Quando è stato registrato (ms), 0 se non si sa. */
  claimedAt: number
}

/** Nomi e chiavi dello streaming nel file di backup. */
export interface StreamingBackup {
  keys: StreamingKey[]
  /** Nome in uso al momento del backup. */
  current?: { service: string; name: string }
}

const normalizeService = (url: string) => url.trim().replace(/\/+$/, '')

/** Chiavi lette dal salvataggio o da un file: si scartano quelle non valide. */
export function cleanKeys(value: unknown): StreamingKey[] {
  if (!Array.isArray(value)) return []
  const keys: StreamingKey[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const v = item as Record<string, unknown>
    if (typeof v.service !== 'string' || !/^https?:\/\/[^/\s]+/.test(v.service)) continue
    if (typeof v.name !== 'string' || !isValidLiveName(v.name)) continue
    if (typeof v.key !== 'string' || !v.key || v.key.length > 200) continue
    keys.push({
      service: normalizeService(v.service),
      name: v.name,
      key: v.key,
      claimedAt: typeof v.claimedAt === 'number' && v.claimedAt > 0 ? v.claimedAt : 0,
    })
  }
  return mergeKeys([], keys)
}

/**
 * Unisce due elenchi di chiavi: un nome per servizio. Se lo stesso nome ha due
 * chiavi diverse vale quella registrata dopo (l'altra non funziona più).
 */
export function mergeKeys(
  current: readonly StreamingKey[],
  incoming: readonly StreamingKey[],
): StreamingKey[] {
  const byName = new Map<string, StreamingKey>()
  for (const k of [...current, ...incoming]) {
    const id = `${k.service} ${k.name}`
    const had = byName.get(id)
    if (!had || k.claimedAt >= had.claimedAt) byName.set(id, k)
  }
  return [...byName.values()]
}

/** Parte "streaming" di un file di backup, se c'è e contiene almeno una chiave. */
export function cleanStreamingBackup(value: unknown): StreamingBackup | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { keys?: unknown; current?: unknown }
  const keys = cleanKeys(v.keys)
  if (keys.length === 0) return null
  const c = v.current as { service?: unknown; name?: unknown } | undefined
  const current =
    c && typeof c.service === 'string' && typeof c.name === 'string'
      ? { service: normalizeService(c.service), name: c.name }
      : null
  return { keys, ...(current ? { current } : {}) }
}
