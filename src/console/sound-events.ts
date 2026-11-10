import type { GameState, GameView } from '../engine'

/** Suoni del tabellone. */
export type SoundId =
  'goal' | 'periodEnd' | 'timeout' | 'timeoutEnd' | 'intermissionEnd' | 'shiftChange' | 'horn'

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
  shiftChange: {
    name: 'Sirena del cambio',
    description:
      'Segnale breve a intervalli regolari mentre il tempo scorre, per il cambio dei giocatori. Si attiva nel regolamento (es. Bambini: ogni minuto).',
  },
  // Non parte mai da sola: la suona l'operatore (soundEvents non la restituisce).
  horn: {
    name: 'Tromba manuale',
    description:
      'Suona finché tieni premuto il pulsante Tromba o il tasto T, e smette quando lasci. Un file personale si ripete finché tieni premuto.',
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
  /** Sirene del cambio già "passate" nel periodo in corso; -1 se non si contano (tempo fermo o sirena spenta). */
  shifts: number
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
    shifts: shiftCount(state, view),
  }
}

function shiftCount(state: GameState, view: GameView): number {
  const every = state.rules.shiftHornMs ?? 0
  // Allo zero suona già la sirena di fine periodo.
  if (!(every > 0) || view.phase !== 'play' || !view.clockRunning || view.clockMs <= 0) return -1
  // Durata vera del periodo in corso (le regole cambiate a metà periodo valgono dal prossimo).
  const length = state.clock.periodEndMs - state.clock.periodStartMs
  const elapsed = length - view.clockMs
  return Math.floor(elapsed / every)
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

  // Sirena del cambio: solo quando il tempo scorre da solo oltre la soglia
  // (non se l'operatore corregge il tempo o lo avvia/ferma).
  if (
    prev.shifts >= 0 &&
    cur.period === prev.period &&
    cur.shifts === prev.shifts + 1 &&
    !newGoal &&
    !periodEnded
  ) {
    sounds.push('shiftChange')
  }

  return sounds
}
