import { describe, expect, it } from 'vitest'
import { apply, createGame, type Command } from './game'
import { rulesFromPreset } from './rules'
import { deriveView, orientView } from './view'
import type { GameState } from './types'

const T0 = 1_000_000
const KICKOFF: Command[] = [{ type: 'startClock' }, { type: 'stopClock' }]

function run(state: GameState, ...commands: Command[]): GameState {
  for (const c of commands) state = apply(state, c, T0)
  return state
}

const swapped = (s: GameState) => deriveView(s, T0).sidesSwapped

describe('lati delle squadre', () => {
  it('Inverti squadre scambia i lati e basta: punti e penalità restano alle squadre', () => {
    const before = run(createGame(), ...KICKOFF, { type: 'goal', team: 'home' })
    const after = run(before, { type: 'swapSides' })
    expect(swapped(before)).toBe(false)
    expect(swapped(after)).toBe(true)
    expect(after.teams.home.goals).toBe(1)
    expect(swapped(run(after, { type: 'swapSides' }))).toBe(false)
  })

  it('cambio campo automatico: lati invertiti nei periodi pari, già dall’intervallo', () => {
    const rules = { ...rulesFromPreset('senior'), switchSides: true }
    let s = run(createGame(rules), ...KICKOFF)
    expect(swapped(s)).toBe(false)
    s = run(s, { type: 'endPeriod' })
    // Il cambio avviene a fine periodo: l'intervallo è già girato.
    expect(s.phase).toBe('intermission')
    expect(swapped(s)).toBe(true)
    s = run(s, { type: 'endIntermission' })
    expect(s.period).toBe(2)
    expect(swapped(s)).toBe(true)
    s = run(s, ...KICKOFF, { type: 'endPeriod' }, { type: 'endIntermission' })
    expect(s.period).toBe(3)
    expect(swapped(s)).toBe(false)
    // Inverti squadre a mano si somma al cambio campo.
    expect(swapped(run(s, { type: 'swapSides' }))).toBe(true)
  })

  it('a fine partita i lati restano come nell’ultimo periodo', () => {
    const rules = { ...rulesFromPreset('senior'), switchSides: true }
    let s = run(createGame(rules), ...KICKOFF, { type: 'endPeriod' }, { type: 'endIntermission' })
    expect(swapped(s)).toBe(true)
    s = run(s, ...KICKOFF, { type: 'goal', team: 'home' }, { type: 'endGame' })
    expect(s.phase).toBe('final')
    expect(swapped(s)).toBe(true)
  })

  it('senza cambio campo nel regolamento i lati non cambiano tra i periodi', () => {
    const s = run(createGame(), ...KICKOFF, { type: 'endPeriod' }, { type: 'endIntermission' })
    expect(s.period).toBe(2)
    expect(swapped(s)).toBe(false)
  })
})

describe('vista girata per i tabelloni', () => {
  const state = run(
    createGame(),
    ...KICKOFF,
    { type: 'goal', team: 'home' },
    { type: 'penalty', team: 'away', player: '12', kind: 'minor' },
    { type: 'timeout', team: 'away' },
  )
  const view = deriveView(state, T0)

  it('a sinistra va l’altra squadra, con tutto quello che ha', () => {
    const flipped = orientView(view, true)
    expect(flipped.teams.home.id).toBe('away')
    expect(flipped.teams.home.name).toBe('Ospiti')
    expect(flipped.teams.away.score).toBe(1)
    expect(flipped.teams.home.penalties).toHaveLength(1)
    expect(flipped.timeout?.team).toBe('home')
    expect(flipped.powerPlay).toBe(view.powerPlay === 'home' ? 'away' : 'home')
  })

  it('senza giro la vista resta com’è', () => {
    expect(orientView(view, false)).toBe(view)
  })
})
