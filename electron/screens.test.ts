import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { defaultChoice, describeScreens, isChoiceValid } = require('./screens.cjs')

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
    expect(defaultChoice([small, laptop, maxi])).toEqual({ consoleId: 1, displayId: 7 })
  })

  it('con un solo schermo usa quello per entrambi', () => {
    expect(defaultChoice([laptop])).toEqual({ consoleId: 1, displayId: 1 })
    expect(defaultChoice([])).toBeNull()
  })

  it('una scelta salvata vale solo se gli schermi sono ancora collegati', () => {
    expect(isChoiceValid({ consoleId: 1, displayId: 7 }, [laptop, maxi])).toBe(true)
    expect(isChoiceValid({ consoleId: 1, displayId: 7 }, [laptop])).toBe(false)
    expect(isChoiceValid(null, [laptop])).toBe(false)
    expect(isChoiceValid({ consoleId: 1 }, [laptop])).toBe(false)
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
