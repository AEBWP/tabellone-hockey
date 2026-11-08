import { describe, expect, it } from 'vitest'
import { cleanKeys, cleanStreamingBackup, mergeKeys, type StreamingKey } from './live'
import { exportLibrary, parseBackup } from './library'

const SERVICE = 'https://live.tabellone-hockey.workers.dev'
const key = (name: string, k: string, claimedAt = 1): StreamingKey => ({
  service: SERVICE,
  name,
  key: k,
  claimedAt,
})

describe('chiavi dello streaming', () => {
  it('tiene un nome per servizio, con la chiave registrata per ultima', () => {
    const merged = mergeKeys([key('palaghiaccio', 'vecchia', 1)], [key('palaghiaccio', 'nuova', 5)])
    expect(merged).toEqual([key('palaghiaccio', 'nuova', 5)])
    expect(mergeKeys([key('a-b-c', 'x', 9)], [key('a-b-c', 'y', 2)])[0].key).toBe('x')
    expect(mergeKeys([key('uno', 'x')], [key('due', 'y')])).toHaveLength(2)
  })

  it('scarta chiavi non valide e toglie la "/" finale del servizio', () => {
    const keys = cleanKeys([
      { ...key('buono', 'k'), service: `${SERVICE}/` },
      { ...key('x', 'k') },
      { ...key('senza-chiave', '') },
      { ...key('servizio', 'k'), service: 'ftp://altro' },
      'ciao',
    ])
    expect(keys).toEqual([key('buono', 'k')])
    expect(cleanKeys('non un elenco')).toEqual([])
  })

  it('il backup porta le chiavi su un altro PC', () => {
    const streaming = {
      keys: [key('palaghiaccio', 'segreta', 3), key('torneo-estivo', 'altra', 4)],
      current: { service: SERVICE, name: 'palaghiaccio' },
    }
    const text = exportLibrary({ teams: [], presets: [], streaming })
    expect(parseBackup(text).streaming).toEqual(streaming)
  })

  it('i backup vecchi o senza chiavi valide non toccano lo streaming', () => {
    expect(parseBackup(exportLibrary({ teams: [], presets: [] })).streaming).toBeUndefined()
    expect(cleanStreamingBackup({ keys: [{ name: 'x' }] })).toBeNull()
  })
})
