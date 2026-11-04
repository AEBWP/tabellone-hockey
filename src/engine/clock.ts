import type { Countdown, GameClock } from './types'

/**
 * Formatta un tempo in millisecondi per il tabellone.
 *
 * - Sopra la soglia dei decimi: `MM:SS` (es. `20:00`, `5:07`).
 * - Sotto la soglia: `S.d` con i decimi (es. `59.3`, `0.4`).
 *
 * I secondi vengono arrotondati per eccesso: con 19:59.2 rimanenti il
 * tabellone mostra ancora `20:00` fino allo scadere del secondo, come
 * fanno i tabelloni da hockey. I decimi invece vengono troncati, così
 * lo `0.0` compare solo a tempo davvero scaduto.
 */
export function formatClock(ms: number, tenthsBelowMs = 60_000): string {
  const safe = Math.max(0, ms)

  if (safe < tenthsBelowMs) {
    const tenths = Math.floor(safe / 100)
    return `${Math.floor(tenths / 10)}.${tenths % 10}`
  }

  const totalSeconds = Math.ceil(safe / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Tempo di gioco assoluto all'istante `now`, senza mai superare la fine del periodo. */
export function gameTimeMs(clock: GameClock, now: number): number {
  const elapsed = clock.runningSince === null ? 0 : now - clock.runningSince
  return Math.min(clock.periodEndMs, clock.baseMs + Math.max(0, elapsed))
}

/** Tempo rimanente nel periodo. */
export function periodRemainingMs(clock: GameClock, now: number): number {
  return clock.periodEndMs - gameTimeMs(clock, now)
}

/** Tempo trascorso nel periodo. */
export function periodElapsedMs(clock: GameClock, now: number): number {
  return gameTimeMs(clock, now) - clock.periodStartMs
}

/**
 * Timestamp in cui il cronometro (in moto) raggiungerà la fine del periodo,
 * oppure null se è fermo.
 */
export function periodEndsAt(clock: GameClock): number | null {
  if (clock.runningSince === null) return null
  return clock.runningSince + (clock.periodEndMs - clock.baseMs)
}

export function countdownRemainingMs(countdown: Countdown, now: number): number {
  const elapsed = countdown.runningSince === null ? 0 : now - countdown.runningSince
  return Math.max(0, countdown.remainingMs - Math.max(0, elapsed))
}

/** Timestamp in cui il conto alla rovescia arriva a zero, oppure null se è fermo. */
export function countdownEndsAt(countdown: Countdown): number | null {
  if (countdown.runningSince === null) return null
  return countdown.runningSince + countdown.remainingMs
}
