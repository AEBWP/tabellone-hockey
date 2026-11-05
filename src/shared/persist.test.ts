import { describe, expect, it } from 'vitest'
import { apply, createGame } from '../engine'
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

  it('scarta dati non validi', () => {
    expect(migrate(null)).toBeNull()
    expect(migrate({ foo: 1 })).toBeNull()
    expect(migrate('testo')).toBeNull()
  })
})
