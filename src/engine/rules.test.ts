import { describe, expect, it } from 'vitest'
import { apply, createGame } from './game'
import { describeRules, PRESETS, rulesFromPreset, validateRules } from './rules'
import { deriveView } from './view'

describe('regole', () => {
  it('i preset sono tutti validi', () => {
    for (const p of PRESETS) expect(validateRules(p.rules), p.id).toEqual([])
  })

  it('segnala valori fuori dai limiti', () => {
    const r = rulesFromPreset('senior')
    r.periods = 0
    r.penaltyMs.minor = 0
    r.timeoutsPerTeam = 9
    const errors = validateRules(r)
    expect(errors).toHaveLength(3)
  })

  it('ignora il supplementare se disattivato', () => {
    const r = rulesFromPreset('giovanili')
    r.overtime.periodMs = -1
    expect(validateRules(r)).toEqual([])
  })

  it('descrizione breve', () => {
    expect(describeRules(rulesFromPreset('senior'))).toBe('3 × 20′, supplementare 5′, rigori')
    expect(describeRules(rulesFromPreset('senior-playoff'))).toBe(
      '3 × 20′, supplementare 20′ a oltranza',
    )
    const r = rulesFromPreset('giovanili')
    r.periodMs = 12.5 * 60_000
    expect(describeRules(r)).toBe('3 × 12′30″, pareggio possibile')
  })
})

describe('cambio regole durante la partita', () => {
  it('a periodo non iniziato cambia anche la durata del periodo attuale', () => {
    const r = rulesFromPreset('senior')
    r.periodMs = 12 * 60_000
    const s = apply(createGame(), { type: 'setRules', rules: r }, 0)
    expect(deriveView(s, 0).clockText).toBe('12:00')
  })

  it('a periodo iniziato vale dal periodo successivo', () => {
    const r = rulesFromPreset('senior')
    r.periodMs = 12 * 60_000
    let s = apply(createGame(), { type: 'startClock' }, 0)
    s = apply(s, { type: 'setRules', rules: r }, 60_000)
    expect(deriveView(s, 60_000).clockText).toBe('19:00')

    s = apply(s, { type: 'endPeriod' }, 60_000)
    s = apply(s, { type: 'endIntermission' }, 60_000)
    expect(deriveView(s, 60_000).clockText).toBe('12:00')
  })

  it('i timeout per squadra si aggiornano subito', () => {
    const r = rulesFromPreset('senior')
    r.timeoutsPerTeam = 2
    const s = apply(createGame(), { type: 'setRules', rules: r }, 0)
    expect(deriveView(s, 0).teams.home.timeoutsLeft).toBe(2)
  })
})

describe('tiri in porta', () => {
  it('nascosti di default in tutti i regolamenti', () => {
    for (const p of PRESETS) expect(p.rules.showShots, p.id).toBe(false)
  })
})
