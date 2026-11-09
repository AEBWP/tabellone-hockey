import { describe, expect, it } from 'vitest'
import { createGame } from '../engine'
import { currentRulesLabel } from './rules-text'

describe('nome del regolamento in uso', () => {
  const rules = createGame().rules
  const mine = { id: 'mio', name: 'Campionato', rules: structuredClone(rules) }

  it('trova il regolamento con le stesse regole, in qualsiasi ordine dei campi', () => {
    const reordered = Object.fromEntries(Object.entries(rules).reverse()) as typeof rules
    expect(currentRulesLabel(reordered, [mine])).toBe('Campionato')
  })

  it('con regole modificate è personalizzato', () => {
    const changed = { ...rules, periodMs: rules.periodMs + 60_000 }
    expect(currentRulesLabel(changed, [mine])).toBe('Personalizzato')
  })
})
