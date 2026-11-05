import { describe, expect, it } from 'vitest'
import { textColorOn } from './color'
import { periodLabel } from './labels'

describe('etichette', () => {
  it('nomi dei periodi', () => {
    expect(periodLabel({ period: 2, periodKind: 'regular', overtimeNumber: 0 })).toBe('2° TEMPO')
    expect(periodLabel({ period: 4, periodKind: 'overtime', overtimeNumber: 1 })).toBe(
      'SUPPLEMENTARE',
    )
    expect(periodLabel({ period: 5, periodKind: 'overtime', overtimeNumber: 2 })).toBe(
      'SUPPLEMENTARE 2',
    )
  })

  it('testo leggibile sopra il colore della squadra', () => {
    expect(textColorOn('#ffd400')).toBe('#0b0f17')
    expect(textColorOn('#1f6feb')).toBe('#ffffff')
    expect(textColorOn('non-un-colore')).toBe('#ffffff')
  })
})

describe('periodo concluso', () => {
  it("durante l'intervallo indica il periodo appena finito", async () => {
    const { previousPeriodLabel } = await import('./labels')
    expect(previousPeriodLabel({ period: 2, periodKind: 'regular', overtimeNumber: 0 })).toBe(
      '1° TEMPO',
    )
    expect(previousPeriodLabel({ period: 4, periodKind: 'overtime', overtimeNumber: 1 })).toBe(
      '3° TEMPO',
    )
    expect(previousPeriodLabel({ period: 5, periodKind: 'overtime', overtimeNumber: 2 })).toBe(
      'SUPPLEMENTARE',
    )
  })
})

describe('adattamento del nome alla larghezza', () => {
  it('lascia la dimensione piena ai nomi corti e riduce quelli lunghi', async () => {
    const { fitFontSize } = await import('./labels')
    expect(fitFontSize('LUPI', 96, 300)).toBe(96)
    expect(fitFontSize('CASTORI', 96, 300)).toBeLessThan(96)
    expect(fitFontSize('CASTORI', 96, 300) * 7 * 0.52).toBeLessThanOrEqual(300)
    // mai sotto poco più di metà, anche con 10 lettere
    expect(fitFontSize('ABCDEFGHIJ', 96, 100)).toBe(53)
  })
})
