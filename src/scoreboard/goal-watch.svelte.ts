import type { GameView, TeamId } from '../engine'

/**
 * Riconosce un nuovo gol: parte solo con il pulsante GOL (cresce
 * `goalEvents`), non con le correzioni ±1 del punteggio.
 * Al primo stato ricevuto (es. tabellone aperto a partita in corso) non
 * segnala nulla; se il gol viene annullato l'animazione si interrompe.
 * Va chiamata durante l'inizializzazione di un componente.
 *
 * Il confronto è per squadra vera (`TeamView.id`), non per lato: scambiare
 * i lati non è un gol. `goal.team` è il lato del disegno dove sta adesso la
 * squadra che ha segnato.
 */
export function watchGoals(getView: () => GameView, durationMs = 7_000) {
  const state = $state<{ goal: { id: TeamId; key: number } | null }>({ goal: null })
  let previous: Record<TeamId, { goals: number; events: number }> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let counter = 0

  $effect(() => {
    const view = getView()
    const current = {} as Record<TeamId, { goals: number; events: number }>
    for (const side of ['home', 'away'] as const) {
      const team = view.teams[side]
      current[team.id ?? side] = { goals: team.goals, events: team.goalEvents ?? 0 }
    }
    const before = previous
    previous = current
    if (!before) return
    for (const id of ['home', 'away'] as const) {
      if (current[id].events > before[id].events) {
        state.goal = { id, key: ++counter }
        clearTimeout(hideTimer)
        hideTimer = setTimeout(() => (state.goal = null), durationMs)
      } else if (current[id].goals < before[id].goals && state.goal?.id === id) {
        state.goal = null
      }
    }
  })

  $effect(() => () => clearTimeout(hideTimer))

  return {
    get goal(): { team: TeamId; key: number } | null {
      const goal = state.goal
      if (!goal) return null
      const view = getView()
      const team: TeamId = (view.teams.home.id ?? 'home') === goal.id ? 'home' : 'away'
      return { team, key: goal.key }
    },
  }
}
