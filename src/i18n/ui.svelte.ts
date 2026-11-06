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

class UiLanguage {
  lang = $state<Language>(loadLanguage())

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
