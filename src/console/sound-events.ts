import type { GameState, GameView } from '../engine'

/** Suoni del tabellone. */
export type SoundId = 'goal' | 'periodEnd' | 'timeout' | 'timeoutEnd' | 'intermissionEnd'

export const SOUND_LABELS: Record<SoundId, { name: string; description: string }> = {
  goal: { name: 'Sirena del gol', description: 'Quando premi GOL (non con le correzioni ±1).' },
  periodEnd: {
    name: 'Sirena di fine periodo',
    description: 'Quando il tempo arriva a zero o termini il periodo.',
  },
  timeout: { name: 'Inizio timeout', description: 'Due segnali brevi alla chiamata del timeout.' },
  timeoutEnd: {
    name: 'Fine timeout',
    description: 'Segnale quando i secondi del timeout finiscono.',
  },
  intermissionEnd: {
    name: 'Fine intervallo',
    description: 'Tre segnali brevi quando l’intervallo finisce: le squadre tornano in pista.',
  },
}

export const SOUND_IDS = Object.keys(SOUND_LABELS) as SoundId[]

/** Quanto serve per capire, da un istante all'altro, se deve partire un suono. */
export interface SoundSnapshot {
  phase: GameView['phase']
  period: number
  /** Id dell'ultimo gol registrato (0 se nessuno). */
  lastGoalId: number
  /** Numero di gol registrati: se scende, è stato annullato qualcosa. */
  goalCount: number
  timeoutActive: boolean
  timeoutRemainingMs: number
}

export function snapshot(state: GameState, view: GameView): SoundSnapshot {
  const goals = state.events.filter((e) => e.type === 'goal')
  return {
    phase: view.phase,
    period: view.period,
    lastGoalId: goals.at(-1)?.id ?? 0,
    goalCount: goals.length,
    timeoutActive: !!view.timeout,
    timeoutRemainingMs: view.timeout?.remainingMs ?? 0,
  }
}

// Fasi in cui si arriva quando un periodo finisce (oltre al cambio di periodo).
const AFTER_PERIOD = new Set<GameView['phase']>(['intermission', 'shootout', 'final'])

/**
 * Suoni da riprodurre passando dallo stato `prev` allo stato `cur`.
 * Funzione pura: le annullate, le correzioni e le nuove partite non suonano.
 */
export function soundEvents(prev: SoundSnapshot, cur: SoundSnapshot): SoundId[] {
  const sounds: SoundId[] = []

  // Nuova partita (o partita ricaricata da zero): niente suoni.
  const reset = cur.goalCount < prev.goalCount || cur.period < prev.period
  if (reset) return sounds

  const newGoal = cur.lastGoalId > prev.lastGoalId
  if (newGoal) sounds.push('goal')

  const periodEnded =
    prev.phase === 'play' && (cur.period !== prev.period || AFTER_PERIOD.has(cur.phase))
  // Il gol decisivo nel supplementare chiude la partita: basta la sirena del gol.
  if (periodEnded && !newGoal) sounds.push('periodEnd')

  if (!prev.timeoutActive && cur.timeoutActive) sounds.push('timeout')
  // Il timeout scaduto da solo (non chiuso a mano riavviando il tempo).
  if (prev.timeoutActive && !cur.timeoutActive && prev.timeoutRemainingMs <= 1_000) {
    sounds.push('timeoutEnd')
  }

  if (prev.phase === 'intermission' && cur.phase === 'ready') sounds.push('intermissionEnd')

  return sounds
}
