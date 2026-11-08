import { describe, expect, it } from 'vitest'
import { apply, createGame, deriveView, type Command, type GameState } from '../engine'
import {
  cleanMusicSettings,
  isAudioFile,
  musicEvent,
  pickNext,
  type MusicEvent,
  type MusicTrack,
} from './music'
import { snapshot } from './sound-events'

const tracks: MusicTrack[] = ['a', 'b', 'c'].map((id) => ({
  id,
  name: `${id}.mp3`,
  path: `D:\\musica\\${id}.mp3`,
  seconds: 60,
}))
const none = new Set<string>()

describe('quando parte la musica', () => {
  function session() {
    let state: GameState = createGame()
    let now = 1_000_000
    let prev = snapshot(state, deriveView(state, now))
    const heard: MusicEvent[] = []
    const check = () => {
      const cur = snapshot(state, deriveView(state, now))
      const event = musicEvent(prev, cur)
      if (event) heard.push(event)
      prev = cur
    }
    const run = (c: Command) => {
      state = apply(state, c, now)
      check()
    }
    return {
      heard,
      /** Gioca il periodo fino alla fine, chiudendolo col comando della console. */
      playPeriod() {
        run({ type: 'startClock' })
        now += 1_000
        run({ type: 'endPeriod' })
      },
      skipBreak() {
        run({ type: 'endIntermission' })
      },
      get phase() {
        return prev.phase
      },
    }
  }

  it('a fine periodo parte e a fine intervallo si ferma', () => {
    const s = session()
    s.playPeriod()
    expect(s.phase).toBe('intermission')
    expect(s.heard).toEqual(['start'])
    s.skipBreak()
    expect(s.heard).toEqual(['start', 'stop'])
  })

  it('parte a ogni intervallo, non solo al primo', () => {
    const s = session()
    s.playPeriod()
    s.skipBreak()
    s.playPeriod()
    expect(s.phase).toBe('intermission')
    expect(s.heard).toEqual(['start', 'stop', 'start'])
  })

  it('una correzione che riporta in gioco ferma la musica', () => {
    expect(musicEvent({ phase: 'intermission' }, { phase: 'play' })).toBe('stop')
  })

  it('riaprendo la console a intervallo in corso non riparte', () => {
    expect(musicEvent({ phase: 'intermission' }, { phase: 'intermission' })).toBeNull()
  })
})

describe('quale brano parte', () => {
  const base = { tracks, lastId: null, played: [], shuffle: false }

  it('in ordine: quello dopo l’ultimo partito, mai lo stesso', () => {
    expect(pickNext(base)?.id).toBe('a')
    expect(pickNext({ ...base, lastId: 'a' })?.id).toBe('b')
    expect(pickNext({ ...base, lastId: 'c' })?.id).toBe('a')
  })

  it('elenco vuoto: nessun brano', () => {
    expect(pickNext({ ...base, tracks: [] })).toBeNull()
  })

  it('casuale: li fa sentire tutti prima di ripeterne uno', () => {
    let state = { ...base, shuffle: true } as Parameters<typeof pickNext>[0]
    const heard: string[] = []
    for (let i = 0; i < 3; i++) {
      const next = pickNext(state, none, () => 0.5)!
      heard.push(next.id)
      state = { ...state, lastId: next.id, played: next.played }
    }
    expect([...heard].sort()).toEqual(['a', 'b', 'c'])
  })

  it('casuale: il giro nuovo non comincia con l’ultimo brano', () => {
    for (const r of [0, 0.5, 0.99]) {
      const next = pickNext(
        { ...base, shuffle: true, lastId: 'b', played: ['a', 'b', 'c'] },
        none,
        () => r,
      )!
      expect(next.id).not.toBe('b')
      expect(next.played).toEqual([next.id])
    }
  })

  it('le tracce non raggiungibili si saltano senza perdere il punto', () => {
    expect(pickNext({ ...base, lastId: 'a' }, new Set(['b']))?.id).toBe('c')
    expect(pickNext({ ...base, lastId: 'b' }, new Set(['b']))?.id).toBe('c')
    expect(pickNext({ ...base, shuffle: true }, new Set(['a', 'c']))?.id).toBe('b')
    expect(pickNext(base, new Set(['a', 'b', 'c']))).toBeNull()
  })

  it('un solo brano si può ripetere', () => {
    const one = { ...base, tracks: [tracks[0]], lastId: 'a' }
    expect(pickNext(one)?.id).toBe('a')
    expect(pickNext({ ...one, shuffle: true, played: ['a'] })?.id).toBe('a')
  })
})

describe('file e impostazioni', () => {
  it('nelle cartelle prende solo i file audio', () => {
    expect(isAudioFile({ name: 'Brano.MP3', type: '' })).toBe(true)
    expect(isAudioFile({ name: 'x', type: 'audio/ogg' })).toBe(true)
    expect(isAudioFile({ name: 'copertina.jpg', type: 'image/jpeg' })).toBe(false)
  })

  it('valori rovinati tornano a quelli iniziali', () => {
    const clean = cleanMusicSettings({
      volume: 400,
      tracks: [{ id: 'a', name: 'a.mp3' }, { id: 3 }, null],
      played: ['a', 1],
    })
    expect(clean.volume).toBe(100)
    expect(clean.tracks).toEqual([{ id: 'a', name: 'a.mp3', path: null, seconds: 0 }])
    expect(clean.played).toEqual(['a'])
    expect(cleanMusicSettings(null).enabled).toBe(true)
    expect(cleanMusicSettings(null).shuffle).toBe(true)
    expect(cleanMusicSettings({ shuffle: false }).shuffle).toBe(false)
  })
})
