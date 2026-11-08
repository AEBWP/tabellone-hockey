import { describe, expect, it } from 'vitest'
import { createGame, deriveView, LANGUAGES } from '../../engine'
import { BOARD_TEXT, phaseLabel } from '../../i18n/board'
import { displayText, fitSegmentHeight, isDrawable, litSegments, SEGMENT_NAMES } from './segments'

describe('display a 14 segmenti', () => {
  it('sa scrivere lettere e numeri, solo con segmenti esistenti', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      expect(litSegments(ch), ch).not.toBe('')
      expect(
        [...litSegments(ch)].every((s) => SEGMENT_NAMES.includes(s)),
        ch,
      ).toBe(true)
    }
  })

  it('niente minuscole e niente accenti', () => {
    expect(displayText('Città')).toBe('CITTA')
    expect(displayText('Über Ñandú')).toBe('UBER NANDU')
  })

  it('sa scrivere le scritte fisse del tabellone in ogni lingua', () => {
    const view = deriveView(createGame(), 0)
    for (const language of LANGUAGES) {
      const t = BOARD_TEXT[language]
      const texts = [
        t.goalExclaimed,
        t.timeout,
        t.penalties,
        t.shootout,
        t.intermission,
        t.powerPlay,
        t.shotsOnGoal,
        t.finalShort,
        phaseLabel({ ...view, language }),
      ]
      for (const text of texts) {
        const missing = [...displayText(text)].filter((ch) => !isDrawable(ch))
        expect(missing, `${language}: ${text}`).toEqual([])
      }
    }
  })

  it('i testi lunghi si rimpiccioliscono per stare nello spazio', () => {
    expect(fitSegmentHeight('LUPI', 96, 580)).toBe(96)
    const height = fitSegmentHeight('SUPERPALAGHIACCIO', 96, 580)
    expect(height).toBeLessThan(96)
    expect(height * 0.72 * 17).toBeLessThanOrEqual(580)
  })
})
