import { createGame, type GameState } from '../engine'
import { desktop } from './desktop'

/**
 * Salvataggio automatico della partita nel browser.
 *
 * Se la console viene ricaricata o il browser si chiude, la partita riparte
 * esattamente da dov'era (il tempo in moto continua a scorrere, perché è
 * calcolato da timestamp). Nel programma installato la partita viene salvata
 * anche su file, come ulteriore sicurezza.
 */
const GAME_KEY = 'tabellone-hockey:partita:v1'

let fileTimer: ReturnType<typeof setTimeout> | undefined

export function saveGame(state: GameState): void {
  const json = JSON.stringify(state)
  try {
    localStorage.setItem(GAME_KEY, json)
  } catch {
    // Memoria piena o non disponibile: la partita continua comunque.
  }
  if (desktop) {
    // Su file con un piccolo ritardo: mentre si scrive un nome non serve salvare a ogni lettera.
    clearTimeout(fileTimer)
    fileTimer = setTimeout(() => desktop?.saveGame(json), 300)
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(GAME_KEY) ?? desktop?.loadGame() ?? null
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
