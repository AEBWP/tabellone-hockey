import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  defaultChoice,
  describeScreens,
  displayPlan,
  isChoiceValid,
  normalizeChoice,
  resolveChoice,
  withIdentities,
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
    expect(defaultChoice([small, laptop, maxi])).toEqual({
      consoleId: 1,
      displayIds: [7],
      mirrorIds: [],
    })
  })

  it('con un solo schermo usa quello per entrambi', () => {
    expect(defaultChoice([laptop])).toEqual({ consoleId: 1, displayIds: [1], mirrorIds: [] })
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
      mirrorIds: [],
    })
    expect(normalizeChoice({ consoleId: 1, displayIds: [7, 7, 3] })).toEqual({
      consoleId: 1,
      displayIds: [7, 3],
      mirrorIds: [],
    })
    expect(normalizeChoice({ consoleId: 1 })).toBeNull()
    expect(normalizeChoice('x')).toBeNull()
  })

  it('tabellone su più schermi: a schermo intero su tutti tranne quello della console', () => {
    const all = [laptop, maxi, small]
    expect(displayPlan({ consoleId: 1, displayIds: [7, 3] }, all)).toEqual([
      { id: 7, mode: 'fullscreen', mirror: false },
      { id: 3, mode: 'fullscreen', mirror: false },
    ])
    expect(displayPlan({ consoleId: 1, displayIds: [7, 1] }, all)).toEqual([
      { id: 7, mode: 'fullscreen', mirror: false },
      { id: 1, mode: 'window', mirror: false },
    ])
  })

  it('schermi scollegati: si saltano; se non ne resta nessuno, finestra sulla console', () => {
    expect(displayPlan({ consoleId: 1, displayIds: [7, 3] }, [laptop, maxi])).toEqual([
      { id: 7, mode: 'fullscreen', mirror: false },
    ])
    expect(displayPlan({ consoleId: 1, displayIds: [7, 3] }, [laptop])).toEqual([
      { id: 1, mode: 'window', mirror: false },
    ])
    // Manca anche lo schermo della console: si usa il principale.
    // Lì c'è la console: il tabellone resta in finestra per non coprirla.
    expect(displayPlan({ consoleId: 9, displayIds: [8] }, [laptop, maxi])).toEqual([
      { id: 1, mode: 'window', mirror: false },
    ])
  })

  describe('scelta salvata ai riavvii', () => {
    const saved = withIdentities({ consoleId: 1, displayIds: [7], mirrorIds: [7] }, [laptop, maxi])
    const ids = (c: { consoleId: number; displayIds: number[]; mirrorIds: number[] }) => [
      c.consoleId,
      c.displayIds,
      c.mirrorIds,
    ]

    it('con gli stessi schermi non cambia nulla', () => {
      expect(resolveChoice(saved, [laptop, maxi])).toEqual(saved)
    })

    it('riconosce gli schermi anche se Windows ha cambiato i loro id', () => {
      const out = resolveChoice(saved, [
        { ...laptop, id: 21 },
        { ...maxi, id: 22 },
      ])
      expect(ids(out)).toEqual([21, [22], [22]])
    })

    it('non si confonde se due schermi si sono scambiati gli id', () => {
      const out = resolveChoice(saved, [
        { ...laptop, id: 7 },
        { ...maxi, id: 1 },
      ])
      expect(ids(out)).toEqual([7, [1], [1]])
    })

    it('due schermi uguali si distinguono dalla posizione', () => {
      const a = { ...maxi, id: 10, bounds: { ...maxi.bounds, x: 1536 } }
      const b = { ...maxi, id: 11, bounds: { ...maxi.bounds, x: 3456 } }
      const twin = withIdentities({ consoleId: 1, displayIds: [11], mirrorIds: [] }, [laptop, a, b])
      const out = resolveChoice(twin, [laptop, { ...a, id: 30 }, { ...b, id: 31 }])
      expect(out.displayIds).toEqual([31])
    })

    it('riconosce lo schermo anche se ha cambiato risoluzione, dal nome', () => {
      const named = { ...maxi, label: 'SAMSUNG' }
      const choice = withIdentities({ consoleId: 1, displayIds: [7], mirrorIds: [] }, [
        laptop,
        named,
      ])
      const out = resolveChoice(choice, [
        laptop,
        { ...named, id: 40, bounds: { ...maxi.bounds, width: 3840, height: 2160 } },
      ])
      expect(out.displayIds).toEqual([40])
    })

    it('schermo davvero assente: resta nella scelta e si riprende quando torna', () => {
      const out = resolveChoice(saved, [laptop])
      expect(ids(out)).toEqual([1, [7], [7]])
      expect(displayPlan(out, [laptop])).toEqual([{ id: 1, mode: 'window', mirror: false }])
      const back = resolveChoice(out, [laptop, { ...maxi, id: 50 }])
      expect(ids(back)).toEqual([1, [50], [50]])
    })

    it('schermo assente il cui id ora è di un altro: non viene confuso con quello', () => {
      const out = resolveChoice(saved, [{ ...laptop, id: 7 }])
      expect(out.consoleId).toBe(7)
      expect(out.displayIds[0]).toBeLessThan(0)
      expect(displayPlan(out, [{ ...laptop, id: 7 }])).toEqual([
        { id: 7, mode: 'window', mirror: false },
      ])
    })

    it('le scelte delle versioni precedenti si riconoscono dall’id e imparano lo schermo', () => {
      const out = resolveChoice({ consoleId: 1, displayId: 7 }, [laptop, maxi])
      expect(ids(out)).toEqual([1, [7], []])
      expect(out.known[7]).toMatchObject({ width: 1920, height: 1080 })
      const moved = resolveChoice(out, [
        { ...laptop, id: 60 },
        { ...maxi, id: 61 },
      ])
      expect(ids(moved)).toEqual([60, [61], []])
    })

    it('una scelta illeggibile non si può usare', () => {
      expect(resolveChoice({ consoleId: 1 }, [laptop])).toBeNull()
    })
  })

  it('schermi girati verso la console: solo tra quelli del tabellone', () => {
    expect(normalizeChoice({ consoleId: 1, displayIds: [7, 3], mirrorIds: [3, 3, 9] })).toEqual({
      consoleId: 1,
      displayIds: [7, 3],
      mirrorIds: [3],
    })
    expect(
      displayPlan({ consoleId: 1, displayIds: [7, 3], mirrorIds: [3] }, [laptop, maxi, small]),
    ).toEqual([
      { id: 7, mode: 'fullscreen', mirror: false },
      { id: 3, mode: 'fullscreen', mirror: true },
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
