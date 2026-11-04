import { createGame, type GameState } from '../engine'

/**
 * Salvataggio automatico della partita nel browser.
 *
 * Se la console viene ricaricata o il browser si chiude, la partita riparte
 * esattamente da dov'era (il tempo in moto continua a scorrere, perché è
 * calcolato da timestamp). In Electron verrà affiancato il salvataggio su file.
 */
const GAME_KEY = 'tabellone-hockey:partita:v1'

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(state))
  } catch {
    // Memoria piena o non disponibile: la partita continua comunque.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(GAME_KEY)
    return raw ? migrate(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/** Completa uno stato salvato da una versione precedente con i campi mancanti. */
export function migrate(saved: unknown): GameState | null {
  if (!saved || typeof saved !== 'object') return null
  const s = saved as Partial<GameState>
  if (!s.rules || !s.teams?.home || !s.teams?.away || !s.clock || !s.phase) return null

  const base = createGame(s.rules)
  return {
    ...base,
    ...s,
    rules: { ...base.rules, ...s.rules },
    teams: {
      home: { ...base.teams.home, ...s.teams.home },
      away: { ...base.teams.away, ...s.teams.away },
    },
  } as GameState
}
