import { LANGUAGES, type Language } from '../engine/types'
import { desktop } from '../shared/desktop'
import { CONSOLE_TEXT } from './console'

/**
 * Lingua della console (e delle altre finestre per l'operatore), separata da
 * quella del tabellone. Resta salvata nel programma; le finestre aperte si
 * aggiornano insieme.
 */

const STORAGE_KEY = 'tabellone-hockey:lingua-console'

/** Nome di ogni lingua scritto nella lingua stessa, per i menu di scelta. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  it: 'Italiano',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
}

const isLanguage = (v: unknown): v is Language => LANGUAGES.includes(v as Language)

function loadLanguage(): Language {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (isLanguage(saved)) return saved
  } catch {
    // Salvataggio non disponibile: si resta in italiano.
  }
  return 'it'
}

/**
 * Lingua scelta nella prima schermata da usare anche sul tabellone: la scelta
 * degli schermi la lascia qui, la console la applica alla partita e la toglie.
 */
const BOARD_REQUEST_KEY = 'tabellone-hockey:lingua-tabellone-richiesta'

export function requestBoardLanguage(language: Language): void {
  try {
    globalThis.localStorage?.setItem(BOARD_REQUEST_KEY, language)
  } catch {
    // Non salvata: il tabellone resta nella sua lingua.
  }
}

/** Lingua del tabellone chiesta dalla prima schermata (una volta sola), se c'è. */
export function takeBoardLanguageRequest(): Language | null {
  try {
    const value = globalThis.localStorage?.getItem(BOARD_REQUEST_KEY)
    if (value === null || value === undefined) return null
    globalThis.localStorage?.removeItem(BOARD_REQUEST_KEY)
    return isLanguage(value) ? value : null
  } catch {
    return null
  }
}

/** La console lo richiama quando la prima schermata chiede una lingua per il tabellone. */
export function onBoardLanguageRequest(callback: () => void): () => void {
  const listener = (e: StorageEvent) => {
    if (e.key === BOARD_REQUEST_KEY && e.newValue !== null) callback()
  }
  globalThis.addEventListener?.('storage', listener)
  return () => globalThis.removeEventListener?.('storage', listener)
}

function hasSavedLanguage(): boolean {
  try {
    return isLanguage(globalThis.localStorage?.getItem(STORAGE_KEY))
  } catch {
    return false
  }
}

class UiLanguage {
  lang = $state<Language>(loadLanguage())
  /** Lingua mai scelta su questo PC (primo avvio). */
  readonly firstTime = !hasSavedLanguage()

  constructor() {
    this.applyToPage()
    // Un'altra finestra (es. la scelta degli schermi) ha cambiato lingua.
    globalThis.addEventListener?.('storage', (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isLanguage(e.newValue)) {
        this.lang = e.newValue
        this.applyToPage()
      }
    })
  }

  set(language: Language) {
    if (!isLanguage(language)) return
    this.lang = language
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, language)
    } catch {
      // Non salvata: vale comunque fino alla chiusura.
    }
    this.applyToPage()
  }

  private applyToPage() {
    if (typeof document !== 'undefined') document.documentElement.lang = this.lang
    // Il programma installato la usa per le sue finestre (chiusura, avvio).
    desktop?.setLanguage?.(this.lang)
  }
}

export const ui = new UiLanguage()

/**
 * Testo nella lingua della console. La chiave è la frase italiana; `{nome}`
 * viene sostituito con il valore corrispondente di `params`.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const lang = ui.lang
  const text = lang === 'it' ? key : (CONSOLE_TEXT[lang].get(key) ?? key)
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}
