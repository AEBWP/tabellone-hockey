import {
  DEFAULT_RULES,
  LANGUAGES,
  validateRules,
  type Language,
  type Rules,
  type TeamSetup,
} from '../engine'
import { cleanStreamingBackup, type StreamingBackup } from './live'

/**
 * Archivio delle impostazioni riutilizzabili: squadre salvate (con logo) e
 * regolamenti personalizzati. Resta salvato nel browser e si può esportare in
 * un file per portarlo su un altro PC (es. dal PC di casa a quello del palaghiaccio).
 */

export interface SavedTeam extends TeamSetup {
  id: string
}

export interface SavedPreset {
  id: string
  name: string
  rules: Rules
}

export interface LibraryData {
  teams: SavedTeam[]
  presets: SavedPreset[]
  /** Preferenze del programma salvate nel backup (solo nel file, non nell'archivio). */
  settings?: BackupSettings
  /**
   * Nomi dello streaming registrati da questa console, con le chiavi segrete:
   * senza, su un altro PC il nome non si potrebbe più usare.
   */
  streaming?: StreamingBackup
}

export interface BackupSettings {
  /** Lingua della console scelta all'avvio o dalla barra in alto. */
  language?: Language
}

const TEAMS_KEY = 'tabellone-hockey:squadre:v1'
const PRESETS_KEY = 'tabellone-hockey:regolamenti:v1'

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ── Salvataggio nel browser ─────────────────────────────────────────────

export function loadLibrary(storage: Storage | undefined = safeStorage()): LibraryData {
  return {
    teams: readList(storage, TEAMS_KEY)
      .map(toTeam)
      .filter((t) => t !== null),
    presets: readList(storage, PRESETS_KEY)
      .map(toPreset)
      .filter((p) => p !== null),
  }
}

/**
 * Salva l'archivio. Restituisce un messaggio di errore se lo spazio è finito
 * (succede solo con moltissimi loghi molto grandi).
 */
export function saveLibrary(
  data: LibraryData,
  storage: Storage | undefined = safeStorage(),
): string | null {
  if (!storage) return 'Salvataggio non disponibile in questo browser.'
  try {
    storage.setItem(TEAMS_KEY, JSON.stringify(data.teams))
    storage.setItem(PRESETS_KEY, JSON.stringify(data.presets))
    return null
  } catch {
    return 'Spazio di salvataggio esaurito: elimina qualche squadra o usa loghi più leggeri.'
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

function readList(storage: Storage | undefined, key: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ── Validazione dei dati letti (dal browser o da un file) ───────────────

function toTeam(value: unknown): SavedTeam | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.name !== 'string' || !v.name.trim()) return null
  return {
    id: typeof v.id === 'string' && v.id ? v.id : newId(),
    name: v.name.slice(0, 40),
    shortName: typeof v.shortName === 'string' ? v.shortName.slice(0, 10) : v.name.slice(0, 4),
    color: typeof v.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : '#1f6feb',
    logo: typeof v.logo === 'string' && v.logo.startsWith('data:image/') ? v.logo : null,
  }
}

function toPreset(value: unknown): SavedPreset | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.name !== 'string' || !v.name.trim() || !v.rules || typeof v.rules !== 'object') {
    return null
  }
  const r = v.rules as Partial<Rules>
  const rules: Rules = {
    ...structuredClone(DEFAULT_RULES),
    ...r,
    overtime: { ...DEFAULT_RULES.overtime, ...r.overtime },
    shootout: { ...DEFAULT_RULES.shootout, ...r.shootout },
    penaltyMs: { ...DEFAULT_RULES.penaltyMs, ...r.penaltyMs },
  }
  if (validateRules(rules).length > 0) return null
  return { id: typeof v.id === 'string' && v.id ? v.id : newId(), name: v.name.slice(0, 40), rules }
}

// ── Esportazione / importazione su file ─────────────────────────────────

const BACKUP_APP = 'tabellone-hockey'

export function exportLibrary(data: LibraryData, at = new Date()): string {
  return JSON.stringify(
    { app: BACKUP_APP, version: 1, exportedAt: at.toISOString(), ...data },
    null,
    2,
  )
}

/** Legge un file di backup. Lancia un errore con un messaggio comprensibile se non è valido. */
export function parseBackup(text: string): LibraryData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Il file non è un backup valido del tabellone.')
  }
  if (!parsed || typeof parsed !== 'object' || (parsed as { app?: unknown }).app !== BACKUP_APP) {
    throw new Error('Il file non è un backup del Tabellone Hockey.')
  }
  const p = parsed as {
    teams?: unknown
    presets?: unknown
    settings?: unknown
    streaming?: unknown
  }
  const settings = toSettings(p.settings)
  const streaming = cleanStreamingBackup(p.streaming)
  return {
    teams: (Array.isArray(p.teams) ? p.teams : []).map(toTeam).filter((t) => t !== null),
    presets: (Array.isArray(p.presets) ? p.presets : []).map(toPreset).filter((x) => x !== null),
    ...(settings ? { settings } : {}),
    ...(streaming ? { streaming } : {}),
  }
}

/** Preferenze lette da un backup; i backup vecchi non le hanno. */
function toSettings(value: unknown): BackupSettings | null {
  if (!value || typeof value !== 'object') return null
  const language = (value as { language?: unknown }).language
  return LANGUAGES.includes(language as Language) ? { language: language as Language } : null
}

/** Unisce due elenchi: gli elementi con lo stesso id vengono sostituiti da quelli nuovi. */
export function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((x) => [x.id, x]))
  for (const item of incoming) byId.set(item.id, item)
  return [...byId.values()]
}
