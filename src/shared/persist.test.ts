import { describe, expect, it } from 'vitest'
import { apply, createGame, type GameState } from '../engine'
import { migrate } from './persist'

describe('ripristino partita salvata', () => {
  it('ricostruisce lo stato salvato', () => {
    const state = apply(createGame(), { type: 'goal', team: 'home' }, 1000)
    const restored = migrate(JSON.parse(JSON.stringify(state)))
    expect(restored).toEqual(state)
  })

  it('aggiunge i campi introdotti dopo (es. logo)', () => {
    const old = JSON.parse(JSON.stringify(createGame()))
    delete old.teams.home.logo
    expect(migrate(old)?.teams.home.logo).toBeNull()
  })

  it('le partite salvate prima dell’opzione loghi li mostrano', () => {
    const old = JSON.parse(JSON.stringify(createGame()))
    delete old.showLogos
    expect(migrate(old)?.showLogos).toBe(true)
  })

  it('le partite salvate prima della scelta della lingua restano in italiano', () => {
    const old = JSON.parse(JSON.stringify(createGame()))
    delete old.boardLanguage
    expect(migrate(old)?.boardLanguage).toBe('it')
  })

  it('ricorda la lingua del tabellone', () => {
    const state = createGame(undefined, undefined, 'arena', 'es')
    expect(migrate(JSON.parse(JSON.stringify(state)))?.boardLanguage).toBe('es')
  })

  it('scarta dati non validi', () => {
    expect(migrate(null)).toBeNull()
    expect(migrate({ foo: 1 })).toBeNull()
    expect(migrate('testo')).toBeNull()
  })
})

describe('sirena del cambio nelle partite salvate prima', () => {
  it('una partita senza il campo resta senza sirena', () => {
    const old = createGame() as unknown as Record<string, unknown>
    const { shiftHornMs: _, ...rules } = old.rules as Record<string, unknown>
    expect(migrate({ ...old, rules })?.rules.shiftHornMs).toBe(0)
  })
})

describe('lati delle squadre nelle partite salvate prima', () => {
  it('le partite salvate dalle versioni precedenti partono con i lati normali', () => {
    const old = createGame() as Partial<GameState>
    delete old.sidesSwapped
    const rules = { ...old.rules } as Partial<GameState['rules']>
    delete rules.switchSides
    const restored = migrate({ ...old, rules })!
    expect(restored.sidesSwapped).toBe(false)
    expect(restored.rules.switchSides).toBe(false)
  })
})
