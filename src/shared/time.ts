/**
 * Orologio condiviso da console e tabellone, in millisecondi.
 *
 * Usa `performance` invece di `Date.now()`: non salta se Windows
 * sincronizza l'ora di sistema durante la partita.
 */
export function now(): number {
  return performance.timeOrigin + performance.now()
}
