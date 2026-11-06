/**
 * La pagina per gli spettatori è sempre l'ultima versione, ma la console che
 * invia può essere più vecchia (o più nuova). Qui lo stato ricevuto diventa
 * uno stato valido per questa versione: campi mancanti → valori predefiniti,
 * stile o lingua sconosciuti → quelli predefiniti.
 */

import { BOARD_STYLES, LANGUAGES, type GameState, type Language } from '../engine'
import { joinLogos } from '../shared/live'
import { migrate } from '../shared/persist'

export function sanitizeState(
  raw: unknown,
  logos: ReadonlyMap<string, string>,
  language: Language,
): GameState | null {
  const rules = (raw as { rules?: Record<string, unknown> } | null)?.rules
  if (rules && typeof rules === 'object' && !('showShots' in rules)) {
    raw = { ...(raw as object), rules: { ...rules, showShots: true } }
  }
  const state = migrate(raw)
  if (!state) return null
  const boardStyle = BOARD_STYLES.includes(state.boardStyle) ? state.boardStyle : BOARD_STYLES[0]
  const boardLanguage = LANGUAGES.includes(language) ? language : 'it'
  return { ...joinLogos(state, logos), boardStyle, boardLanguage }
}

/** Lingua iniziale per chi guarda: quella del browser, se il tabellone la conosce. */
export function browserLanguage(languages: readonly string[]): Language | null {
  for (const tag of languages) {
    const code = tag.slice(0, 2).toLowerCase() as Language
    if (LANGUAGES.includes(code)) return code
  }
  return null
}

/** Il nome del palaghiaccio dall'indirizzo della pagina ("/nome" → "nome"). */
export function nameFromPath(pathname: string): string {
  const first = pathname.split('/').filter(Boolean)[0] ?? ''
  try {
    return decodeURIComponent(first).toLowerCase()
  } catch {
    return ''
  }
}
