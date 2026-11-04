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
