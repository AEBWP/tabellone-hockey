import type { GameView, TeamId } from '../engine'

/**
 * Riconosce un nuovo gol confrontando il punteggio con quello precedente.
 * Al primo stato ricevuto (es. tabellone aperto a partita in corso) non
 * segnala nulla; se il gol viene annullato l'animazione si interrompe.
 * Va chiamata durante l'inizializzazione di un componente.
 */
export function watchGoals(getView: () => GameView, durationMs = 7_000) {
  const state = $state<{ goal: { team: TeamId; key: number } | null }>({ goal: null })
  let previous: Record<TeamId, number> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let counter = 0

  $effect(() => {
    const view = getView()
    const current = { home: view.teams.home.goals, away: view.teams.away.goals }
    const before = previous
    previous = current
    if (!before) return
    for (const team of ['home', 'away'] as const) {
      if (current[team] > before[team]) {
        state.goal = { team, key: ++counter }
        clearTimeout(hideTimer)
        hideTimer = setTimeout(() => (state.goal = null), durationMs)
      } else if (current[team] < before[team] && state.goal?.team === team) {
        state.goal = null
      }
    }
  })

  $effect(() => () => clearTimeout(hideTimer))

  return state
}
