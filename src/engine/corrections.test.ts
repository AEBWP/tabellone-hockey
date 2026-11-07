import { describe, expect, it } from 'vitest'
import { apply, createGame, type Command } from './game'
import { rulesFromPreset } from './rules'
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

describe('gol solo a gioco in corso', () => {
  const senior = rulesFromPreset('senior')
  const toThird = (): GameState =>
    run(
      createGame(senior),
      { type: 'startClock' },
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'startClock' },
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'startClock' },
    )

  it('nell’intervallo GOL non fa nulla, la correzione +1 sì', () => {
    const pause = run(started(), { type: 'endPeriod' })
    expect(pause.phase).toBe('intermission')
    expect(run(pause, { type: 'goal', team: 'away' })).toEqual(pause)
    const corrected = run(pause, { type: 'setScore', team: 'away', goals: 1 })
    expect(corrected.teams.away.goals).toBe(1)
    expect(corrected.events).toEqual([])
  })

  it('dopo la sirena del 3° tempo in parità il GOL tardivo non finisce nel supplementare', () => {
    const ot = run(toThird(), { type: 'endPeriod' })
    expect(deriveView(ot, T0).periodKind).toBe('overtime')
    expect(run(ot, { type: 'goal', team: 'home' }).teams.home.goals).toBe(0)
  })

  it('niente gol prima del via del periodo né a fine partita', () => {
    const ready = run(started(), { type: 'endPeriod' }, { type: 'endIntermission' })
    expect(ready.phase).toBe('ready')
    expect(run(ready, { type: 'goal', team: 'home' }).teams.home.goals).toBe(0)
    const final = run(started(), { type: 'endGame' })
    expect(run(final, { type: 'goal', team: 'home' }).teams.home.goals).toBe(0)
  })

  it('a tempo fermo durante il periodo il gol si registra', () => {
    const stopped = run(started(), { type: 'stopClock' })
    expect(run(stopped, { type: 'goal', team: 'home' }).teams.home.goals).toBe(1)
  })
})

describe('correzione −1 del punteggio', () => {
  it('toglie l’ultimo gol di quella squadra dalla cronaca', () => {
    const s = run(
      started(),
      { type: 'goal', team: 'home' },
      { type: 'goal', team: 'away' },
      { type: 'goal', team: 'home' },
      { type: 'setScore', team: 'home', goals: 1 },
    )
    const goals = s.events.filter((e) => e.type === 'goal')
    expect(goals.map((e) => [e.team, e.id])).toEqual([
      ['home', 1],
      ['away', 2],
    ])
    expect(deriveView(s, T0).teams.home.goalEvents).toBe(1)
  })

  it('dopo un +1 il −1 non tocca la cronaca', () => {
    const s = run(
      started(),
      { type: 'goal', team: 'home' },
      { type: 'setScore', team: 'home', goals: 2 },
      { type: 'setScore', team: 'home', goals: 1 },
    )
    expect(s.events).toHaveLength(1)
  })
})

describe('gol annullato con −1: si torna come per regolamento', () => {
  const SEC = 1_000
  const MIN = 60 * SEC
  const at = (s: GameState, ms: number, ...commands: Command[]) => {
    for (const c of commands) s = apply(s, c, ms)
    return s
  }

  it('gol in superiorità annullato: la minore riprende con il tempo che mancava', () => {
    let s = at(createGame(), T0, { type: 'startClock' })
    s = at(s, T0 + MIN, { type: 'penalty', team: 'away', player: '7', kind: 'minor' })
    s = at(s, T0 + MIN + 30 * SEC, { type: 'goal', team: 'home' }, { type: 'stopClock' })
    expect(deriveView(s, T0 + 2 * MIN).teams.away.penalties).toEqual([])
    s = at(s, T0 + 2 * MIN, { type: 'setScore', team: 'home', goals: 0 })
    const v = deriveView(s, T0 + 2 * MIN)
    expect(v.teams.away.penalties.map((p) => p.text)).toEqual(['1:30'])
    expect(v.powerPlay).toBe('home')
    // Riparte il tempo: la penalità scade dopo il minuto e mezzo che mancava.
    s = at(s, T0 + 3 * MIN, { type: 'startClock' })
    expect(deriveView(s, T0 + 3 * MIN + 89 * SEC).teams.away.penalties).toHaveLength(1)
    expect(deriveView(s, T0 + 3 * MIN + 91 * SEC).teams.away.penalties).toHaveLength(0)
  })

  it('la penalità in attesa partita al suo posto torna in attesa', () => {
    let s = at(createGame(), T0, { type: 'startClock' })
    s = at(
      s,
      T0 + MIN,
      { type: 'penalty', team: 'away', player: '1', kind: 'minor' },
      { type: 'penalty', team: 'away', player: '2', kind: 'minor' },
      { type: 'penalty', team: 'away', player: '3', kind: 'minor' },
    )
    s = at(s, T0 + MIN + 10 * SEC, { type: 'goal', team: 'home' })
    expect(deriveView(s, T0 + MIN + 10 * SEC).teams.away.penalties.filter((p) => p.queued)).toEqual(
      [],
    )
    s = at(s, T0 + MIN + 20 * SEC, { type: 'setScore', team: 'home', goals: 0 })
    const pens = deriveView(s, T0 + MIN + 20 * SEC).teams.away.penalties
    expect(pens.map((p) => [p.player, p.queued, p.text])).toEqual([
      ['1', false, '1:40'],
      ['2', false, '1:40'],
      ['3', true, '2:00'],
    ])
  })

  it('doppia minore: torna la prima parte', () => {
    let s = at(createGame(), T0, { type: 'startClock' })
    s = at(s, T0 + MIN, { type: 'penalty', team: 'away', player: '9', kind: 'double-minor' })
    s = at(s, T0 + 2 * MIN, { type: 'goal', team: 'home' })
    expect(deriveView(s, T0 + 2 * MIN).teams.away.penalties[0].text).toBe('2:00')
    s = at(s, T0 + 2 * MIN, { type: 'setScore', team: 'home', goals: 0 })
    expect(deriveView(s, T0 + 2 * MIN).teams.away.penalties[0].text).toBe('3:00')
  })

  it('penalità già cancellata a mano: il −1 non la fa ricomparire', () => {
    let s = at(createGame(), T0, { type: 'startClock' })
    s = at(s, T0 + MIN, { type: 'penalty', team: 'away', player: '7', kind: 'minor' })
    s = at(s, T0 + 2 * MIN, { type: 'goal', team: 'home' })
    const id = s.penalties[0].id
    s = at(s, T0 + 2 * MIN, { type: 'removePenalty', id })
    s = at(s, T0 + 2 * MIN, { type: 'setScore', team: 'home', goals: 0 })
    expect(s.penalties).toEqual([])
  })

  const senior = () => createGame(rulesFromPreset('senior'))
  const toOvertime = (): GameState =>
    run(
      senior(),
      { type: 'startClock' },
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'startClock' },
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'startClock' },
      { type: 'endPeriod' },
    )

  it('gol decisivo del supplementare annullato: si riprende a giocare', () => {
    const won = run(toOvertime(), { type: 'startClock' }, { type: 'goal', team: 'away' })
    expect(won.phase).toBe('final')
    const reopened = run(won, { type: 'setScore', team: 'away', goals: 0 })
    expect(reopened.phase).toBe('play')
    expect(deriveView(reopened, T0).periodKind).toBe('overtime')
    expect(reopened.clock.runningSince).toBeNull()
  })

  it('gol sulla sirena del 3° tempo convalidato con +1: niente supplementare, partita finita', () => {
    const ot = toOvertime()
    expect(ot.phase).toBe('ready')
    const done = run(ot, { type: 'setScore', team: 'home', goals: 1 })
    const v = deriveView(done, T0)
    expect(v.phase).toBe('final')
    expect(v.period).toBe(3)
    expect(v.periodKind).toBe('regular')
    // E tolto di nuovo: parità, si torna al supplementare.
    const again = run(done, { type: 'setScore', team: 'home', goals: 0 })
    expect(deriveView(again, T0).phase).toBe('ready')
    expect(deriveView(again, T0).periodKind).toBe('overtime')
  })

  it('a fine 3° tempo 3-2 annullato in 2-2: parte il supplementare', () => {
    let s = run(
      senior(),
      { type: 'startClock' },
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'startClock' },
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'startClock' },
      { type: 'goal', team: 'home' },
      { type: 'endPeriod' },
    )
    expect(s.phase).toBe('final')
    s = run(s, { type: 'setScore', team: 'home', goals: 0 })
    expect(deriveView(s, T0).periodKind).toBe('overtime')
    expect(s.phase).toBe('ready')
  })

  it('rigori non ancora iniziati e gol convalidato: partita finita senza rigori', () => {
    const so = run(toOvertime(), { type: 'startClock' }, { type: 'endPeriod' })
    expect(so.phase).toBe('shootout')
    const done = run(so, { type: 'setScore', team: 'away', goals: 1 })
    expect(done.phase).toBe('final')
    expect(done.shootout).toBeNull()
  })
})

describe('correggi tempo a zero prima del via', () => {
  it('chiude il periodo invece di lasciare il tempo bloccato', () => {
    const ready = run(started(), { type: 'endPeriod' }, { type: 'endIntermission' })
    expect(ready.phase).toBe('ready')
    const s = run(ready, { type: 'setClock', remainingMs: 0 })
    expect(s.phase).toBe('intermission')
    expect(s.period).toBe(3)
  })
})
