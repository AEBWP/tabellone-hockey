import { describe, expect, it } from 'vitest'
import { rulesFromPreset } from '../engine'
import {
  exportLibrary,
  loadLibrary,
  mergeById,
  parseBackup,
  saveLibrary,
  type LibraryData,
} from './library'

/** Archivio finto in memoria, al posto di localStorage. */
function memoryStorage(limit = Infinity): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => {
      if (v.length > limit) throw new Error('QuotaExceededError')
      data.set(k, v)
    },
  }
}

const sample: LibraryData = {
  teams: [
    { id: 't1', name: 'Castori', shortName: 'CAS', color: '#d62839', logo: null },
    {
      id: 't2',
      name: 'Lupi',
      shortName: 'LUP',
      color: '#1f6feb',
      logo: 'data:image/png;base64,AAAA',
    },
  ],
  presets: [{ id: 'p1', name: 'Under 13', rules: rulesFromPreset('giovanili') }],
}

describe('archivio', () => {
  it('salva e ricarica squadre e regolamenti', () => {
    const storage = memoryStorage()
    expect(saveLibrary(sample, storage)).toBeNull()
    expect(loadLibrary(storage)).toEqual(sample)
  })

  it('segnala lo spazio esaurito', () => {
    expect(saveLibrary(sample, memoryStorage(10))).toMatch(/Spazio/)
  })

  it('archivio vuoto o rovinato = elenchi vuoti', () => {
    const storage = memoryStorage()
    expect(loadLibrary(storage)).toEqual({ teams: [], presets: [] })
    storage.setItem('tabellone-hockey:squadre:v1', '{rotto')
    expect(loadLibrary(storage).teams).toEqual([])
  })
})

describe('backup su file', () => {
  it('esporta e reimporta gli stessi dati', () => {
    expect(parseBackup(exportLibrary(sample))).toEqual(sample)
  })

  it('rifiuta file che non sono backup', () => {
    expect(() => parseBackup('ciao')).toThrow(/non è un backup/)
    expect(() => parseBackup('{"teams": []}')).toThrow(/Tabellone Hockey/)
  })

  it('scarta voci non valide e corregge i colori', () => {
    const text = JSON.stringify({
      app: 'tabellone-hockey',
      teams: [{ name: '' }, { name: 'Orsi', color: 'rosso', logo: 'http://esterno/logo.png' }],
      presets: [{ name: 'Rotto', rules: { periods: 0 } }],
    })
    const data = parseBackup(text)
    expect(data.presets).toEqual([])
    expect(data.teams).toHaveLength(1)
    expect(data.teams[0]).toMatchObject({ name: 'Orsi', color: '#1f6feb', logo: null })
  })

  it("l'importazione aggiorna le voci con lo stesso id e aggiunge le nuove", () => {
    const merged = mergeById(sample.teams, [
      { id: 't2', name: 'Lupi del Lago', shortName: 'LUP', color: '#1f6feb', logo: null },
      { id: 't3', name: 'Orsi', shortName: 'ORS', color: '#333333', logo: null },
    ])
    expect(merged.map((t) => t.name)).toEqual(['Castori', 'Lupi del Lago', 'Orsi'])
  })
})
