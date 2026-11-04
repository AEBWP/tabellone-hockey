import { describe, expect, it } from 'vitest'
import { createGame, rulesFromPreset } from '../engine'
import { describeEvent, durationLabel, penaltyButtonLabel, shortPeriod } from './format'

describe('formattazione console', () => {
  it('durate brevi', () => {
    expect(durationLabel(120_000)).toBe('2′')
    expect(durationLabel(90_000)).toBe('1′30″')
    expect(durationLabel(30_000)).toBe('30″')
  })

  it('etichette dei pulsanti penalità secondo le regole', () => {
    const rules = rulesFromPreset('senior')
    expect(penaltyButtonLabel('double-minor', rules)).toBe('2′+2′')
    expect(penaltyButtonLabel('misconduct', rules)).toBe('10′')
    rules.penaltyMs.minor = 90_000
    expect(penaltyButtonLabel('minor', rules)).toBe('1′30″')
  })

  it('periodi abbreviati', () => {
    const rules = rulesFromPreset('senior')
    expect(shortPeriod(2, rules)).toBe('2° T')
    expect(shortPeriod(4, rules)).toBe('SUPPL.')
    expect(shortPeriod(5, rules)).toBe('SUPPL. 2')
  })

  it('righe del registro eventi', () => {
    const g = createGame()
    const line = describeEvent(
      {
        id: 1,
        type: 'goal',
        team: 'home',
        player: '17',
        period: 1,
        periodElapsedMs: 754_000,
        powerPlay: true,
        shortHanded: false,
      },
      g.teams,
      g.rules,
    )
    expect(line).toEqual({ when: '1° T 12:34', text: 'Gol Casa #17 (superiorità)' })
  })
})
