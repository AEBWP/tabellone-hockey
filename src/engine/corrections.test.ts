import { describe, expect, it } from 'vitest'
import { apply, createGame, type Command } from './game'
import { deriveView } from './view'
import type { GameState } from './types'

const T0 = 1_000_000

function run(state: GameState, ...commands: Command[]): GameState {
  for (const c of commands) state = apply(state, c, T0)
  return state
}

const started = () => run(createGame(), { type: 'startClock' })

describe('ripristino del timeout', () => {
  it('restituisce il timeout e chiude quello in corso', () => {
    const called = run(started(), { type: 'timeout', team: 'home' })
    expect(deriveView(called, T0).teams.home.timeoutsLeft).toBe(0)
    const restored = run(called, { type: 'restoreTimeout', team: 'home' })
    const view = deriveView(restored, T0)
    expect(view.teams.home.timeoutsLeft).toBe(1)
    expect(view.timeout).toBeNull()
    // Il tempo resta fermo: lo riavvia l'operatore.
    expect(view.clockRunning).toBe(false)
  })

  it('non tocca il timeout in corso dell’altra squadra, e non va oltre il massimo', () => {
    const s = run(
      started(),
      { type: 'timeout', team: 'home' },
      { type: 'endTimeout' },
      { type: 'startClock' },
      { type: 'timeout', team: 'away' },
      { type: 'restoreTimeout', team: 'home' },
    )
    expect(deriveView(s, T0).timeout?.team).toBe('away')
    expect(deriveView(s, T0).teams.home.timeoutsLeft).toBe(1)
    const again = run(s, { type: 'restoreTimeout', team: 'home' })
    expect(deriveView(again, T0).teams.home.timeoutsLeft).toBe(1)
  })
})

describe('animazione del gol', () => {
  it('conta solo i gol del pulsante GOL, non le correzioni ±1', () => {
    const s = run(started(), { type: 'goal', team: 'home' })
    expect(deriveView(s, T0).teams.home.goalEvents).toBe(1)
    const corrected = run(s, { type: 'setScore', team: 'home', goals: 2 })
    expect(deriveView(corrected, T0).teams.home.goals).toBe(2)
    expect(deriveView(corrected, T0).teams.home.goalEvents).toBe(1)
  })
})
