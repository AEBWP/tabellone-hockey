import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  defaultChoice,
  describeScreens,
  displayPlan,
  isChoiceValid,
  normalizeChoice,
} = require('./screens.cjs')

const laptop = {
  id: 1,
  primary: true,
  scaleFactor: 1.25,
  bounds: { x: 0, y: 0, width: 1536, height: 864 },
}
const maxi = {
  id: 7,
  primary: false,
  scaleFactor: 1,
  bounds: { x: 1536, y: 0, width: 1920, height: 1080 },
}
const small = {
  id: 3,
  primary: false,
  scaleFactor: 1,
  bounds: { x: -1024, y: 0, width: 1024, height: 768 },
}

describe('scelta degli schermi', () => {
  it('console sul principale, tabellone sul più grande degli altri', () => {
    expect(defaultChoice([small, laptop, maxi])).toEqual({ consoleId: 1, displayIds: [7] })
  })

  it('con un solo schermo usa quello per entrambi', () => {
    expect(defaultChoice([laptop])).toEqual({ consoleId: 1, displayIds: [1] })
    expect(defaultChoice([])).toBeNull()
  })

  it('una scelta salvata vale solo se gli schermi sono ancora collegati', () => {
    expect(isChoiceValid({ consoleId: 1, displayId: 7 }, [laptop, maxi])).toBe(true)
    expect(isChoiceValid({ consoleId: 1, displayId: 7 }, [laptop])).toBe(false)
    expect(isChoiceValid(null, [laptop])).toBe(false)
    expect(isChoiceValid({ consoleId: 1 }, [laptop])).toBe(false)
    expect(isChoiceValid({ consoleId: 1, displayIds: [] }, [laptop])).toBe(false)
  })

  it('il tabellone può stare su più schermi: tutti devono essere collegati', () => {
    expect(isChoiceValid({ consoleId: 1, displayIds: [7, 3] }, [laptop, maxi, small])).toBe(true)
    expect(isChoiceValid({ consoleId: 1, displayIds: [7, 3] }, [laptop, maxi])).toBe(false)
  })

  it('le scelte salvate dalle versioni precedenti (un solo schermo) restano valide', () => {
    expect(normalizeChoice({ consoleId: 1, displayId: 7 })).toEqual({
      consoleId: 1,
      displayIds: [7],
    })
    expect(normalizeChoice({ consoleId: 1, displayIds: [7, 7, 3] })).toEqual({
      consoleId: 1,
      displayIds: [7, 3],
    })
    expect(normalizeChoice({ consoleId: 1 })).toBeNull()
    expect(normalizeChoice('x')).toBeNull()
  })

  it('tabellone su più schermi: a schermo intero su tutti tranne quello della console', () => {
    const all = [laptop, maxi, small]
    expect(displayPlan({ consoleId: 1, displayIds: [7, 3] }, all)).toEqual([
      { id: 7, mode: 'fullscreen' },
      { id: 3, mode: 'fullscreen' },
    ])
    expect(displayPlan({ consoleId: 1, displayIds: [7, 1] }, all)).toEqual([
      { id: 7, mode: 'fullscreen' },
      { id: 1, mode: 'window' },
    ])
  })

  it('schermi scollegati: si saltano; se non ne resta nessuno, finestra sulla console', () => {
    expect(displayPlan({ consoleId: 1, displayIds: [7, 3] }, [laptop, maxi])).toEqual([
      { id: 7, mode: 'fullscreen' },
    ])
    expect(displayPlan({ consoleId: 1, displayIds: [7, 3] }, [laptop])).toEqual([
      { id: 1, mode: 'window' },
    ])
    // Manca anche lo schermo della console: si usa il principale.
    expect(displayPlan({ consoleId: 9, displayIds: [8] }, [laptop, maxi])).toEqual([
      { id: 1, mode: 'fullscreen' },
    ])
  })

  it('numera da sinistra a destra con la risoluzione reale', () => {
    const list = describeScreens([laptop, maxi, small])
    expect(list.map((s: { id: number }) => s.id)).toEqual([3, 1, 7])
    expect(list[1]).toMatchObject({
      number: 2,
      title: 'Schermo 2 (principale)',
      resolution: '1920×1080',
    })
    expect(list[2]).toMatchObject({ title: 'Schermo 3', resolution: '1920×1080' })
  })
})
