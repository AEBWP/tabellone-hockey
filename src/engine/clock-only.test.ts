import { describe, expect, it } from 'vitest'
import { apply, createGame, deriveView, rulesFromPreset, validateRules } from '.'
import { migrate } from '../shared/persist'

const MIN = 60_000
const rules = rulesFromPreset('torneo-giovanile')

describe('Torneo Giovanile (solo cronometro)', () => {
  it('è un regolamento valido: un tempo solo, sirena del cambio ogni minuto', () => {
    expect(validateRules(rules)).toEqual([])
    expect(rules).toMatchObject({ clockOnly: true, periods: 1, periodMs: 21 * MIN })
    expect(rules.shiftHornMs).toBe(MIN)
    expect(deriveView(createGame(rules), 0).clockOnly).toBe(true)
  })

  it('il tempo si ferma e riparte, a zero la partita è finita', () => {
    let s = apply(createGame(rules), { type: 'startClock' }, 0)
    s = apply(s, { type: 'stopClock' }, 5 * MIN)
    expect(deriveView(s, 9 * MIN).clockMs).toBe(16 * MIN)
    s = apply(s, { type: 'startClock' }, 9 * MIN)
    expect(deriveView(s, 25 * MIN - 1).phase).toBe('play')
    expect(deriveView(s, 25 * MIN).phase).toBe('final')
  })

  it('niente supplementari o periodi anche se il regolamento ne avesse', () => {
    const many = { ...rulesFromPreset('senior'), clockOnly: true, periodMs: MIN }
    const s = apply(createGame(many), { type: 'startClock' }, 0)
    expect(deriveView(s, MIN).phase).toBe('final')
  })

  it('punti, tiri, penalità e timeout non esistono', () => {
    const started = apply(createGame(rules), { type: 'startClock' }, 0)
    const commands = [
      { type: 'goal', team: 'home' },
      { type: 'setScore', team: 'away', goals: 3 },
      { type: 'shot', team: 'home', delta: 1 },
      { type: 'penalty', team: 'home', player: '7', kind: 'minor' },
      { type: 'timeout', team: 'away' },
    ] as const
    for (const command of commands) {
      expect(apply(started, command, 1000), command.type).toEqual(started)
    }
  })

  it('un nuovo cronometro riparte da capo con le stesse regole', () => {
    const started = apply(createGame(rules), { type: 'startClock' }, 0)
    const again = apply(started, { type: 'newGame' }, 22 * MIN)
    expect(deriveView(again, 22 * MIN)).toMatchObject({
      phase: 'ready',
      clockOnly: true,
      clockMs: 21 * MIN,
    })
  })

  it('le partite salvate dalle versioni precedenti restano partite normali', () => {
    const { clockOnly: _, ...old } = createGame().rules
    expect(migrate({ ...createGame(), rules: old })?.rules.clockOnly).toBe(false)
  })
})
