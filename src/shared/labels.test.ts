import { describe, expect, it } from 'vitest'
import { textColorOn } from './color'

describe('colori', () => {
  it('testo leggibile sopra il colore della squadra', () => {
    expect(textColorOn('#ffd400')).toBe('#0b0f17')
    expect(textColorOn('#1f6feb')).toBe('#ffffff')
    expect(textColorOn('non-un-colore')).toBe('#ffffff')
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
