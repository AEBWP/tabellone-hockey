import type { ShootoutState, TeamId } from './types'

function goals(shots: readonly boolean[]): number {
  return shots.filter(Boolean).length
}

/**
 * Vincitore dei rigori, oppure null se non ancora deciso.
 *
 * Nella serie regolare (`rounds` tiri a testa) la serie si chiude appena una
 * squadra non può più essere raggiunta. Poi si prosegue a "morte improvvisa":
 * dopo ogni coppia di tiri, se una squadra ha segnato più dell'altra, vince.
 */
export function shootoutWinner(shootout: ShootoutState, rounds: number): TeamId | null {
  const h = shootout.home
  const a = shootout.away
  const hg = goals(h)
  const ag = goals(a)

  const homeLeft = Math.max(0, rounds - h.length)
  const awayLeft = Math.max(0, rounds - a.length)

  if (h.length <= rounds && a.length <= rounds) {
    if (hg > ag + awayLeft) return 'home'
    if (ag > hg + homeLeft) return 'away'
    return null
  }

  // Morte improvvisa: si decide solo a coppie di tiri complete.
  if (h.length === a.length && hg !== ag) return hg > ag ? 'home' : 'away'
  return null
}
