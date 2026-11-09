import { describe, expect, it } from 'vitest'
import { DEFAULT_AUDIO, normalizeAudioSettings, resolveSource } from './audio.svelte'
import { SOUND_PRESETS, findPreset } from './sound-presets'
import { SOUND_RHYTHMS, TIMBRES } from './synth'

describe('SOUND_PRESETS', () => {
  it('ha id unici, diversi da synth e custom', () => {
    const ids = SOUND_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('synth')
    expect(ids).not.toContain('custom')
  })

  it('trova le varianti per id', () => {
    expect(findPreset('tv-horn')?.name).toBe('Sirena televisiva')
    expect(findPreset('inesistente')).toBeUndefined()
  })

  it('ogni variante ha il timbro del gol e quello degli altri segnali', () => {
    for (const p of SOUND_PRESETS) {
      expect(TIMBRES[p.id].goal.freqs.length).toBeGreaterThan(0)
      expect(TIMBRES[p.id].signal.freqs.length).toBeGreaterThan(0)
    }
  })

  it('i timbri non contengono tempi: durate e pause restano quelle di SOUND_RHYTHMS', () => {
    for (const timbre of Object.values(TIMBRES)) {
      for (const tone of [timbre.goal, timbre.signal]) {
        for (const key of ['start', 'duration', 'attack', 'release', 'length', 'gap', 'count']) {
          expect(tone).not.toHaveProperty(key)
        }
      }
    }
  })
})

describe('SOUND_RHYTHMS', () => {
  it('fissa colpi, durate e pause di ogni segnale', () => {
    const rhythm = (id: keyof typeof SOUND_RHYTHMS) => {
      const { count, length, gap } = SOUND_RHYTHMS[id]
      return [count, length, gap]
    }
    expect(rhythm('goal')).toEqual([1, 4, 0])
    expect(rhythm('periodEnd')).toEqual([1, 2.6, 0])
    expect(rhythm('timeout')).toEqual([2, 0.45, 0.25])
    expect(rhythm('timeoutEnd')).toEqual([1, 1.1, 0])
    expect(rhythm('intermissionEnd')).toEqual([3, 0.35, 0.2])
    expect(rhythm('shiftChange')).toEqual([1, 1.2, 0])
  })
})

describe('resolveSource', () => {
  it('senza impostazioni usa il sintetizzato', () => {
    expect(resolveSource({ custom: {}, source: {} }, 'goal')).toBe('synth')
  })

  it('impostazioni vecchie: un file caricato senza sorgente vale come custom', () => {
    expect(resolveSource({ custom: { goal: 'sirena.mp3' }, source: {} }, 'goal')).toBe('custom')
  })

  it('rispetta la sorgente scelta anche se esiste un file caricato', () => {
    const settings = { custom: { goal: 'sirena.mp3' }, source: { goal: 'air-horn-classic' } }
    expect(resolveSource(settings, 'goal')).toBe('air-horn-classic')
    expect(resolveSource({ ...settings, source: { goal: 'synth' } }, 'goal')).toBe('synth')
  })

  it('custom senza file o predefinito sconosciuto tornano al sintetizzato', () => {
    expect(resolveSource({ custom: {}, source: { goal: 'custom' } }, 'goal')).toBe('synth')
    expect(resolveSource({ custom: {}, source: { goal: 'non-esiste' } }, 'goal')).toBe('synth')
  })
})

describe('normalizeAudioSettings', () => {
  it('valori mancanti o rovinati → predefiniti', () => {
    expect(normalizeAudioSettings(null)).toEqual(DEFAULT_AUDIO)
    expect(normalizeAudioSettings('x')).toEqual(DEFAULT_AUDIO)
    expect(normalizeAudioSettings([])).toEqual(DEFAULT_AUDIO)
  })

  it('migra le impostazioni vecchie: i file caricati diventano sorgente custom', () => {
    const s = normalizeAudioSettings({
      volume: 50,
      muted: true,
      enabled: { goal: false },
      outputId: 'hdmi',
      custom: { goal: 'sirena.mp3' },
    })
    expect(s.volume).toBe(50)
    expect(s.muted).toBe(true)
    expect(s.enabled.goal).toBe(false)
    expect(s.enabled.periodEnd).toBe(true)
    expect(s.outputId).toBe('hdmi')
    expect(s.custom).toEqual({ goal: 'sirena.mp3' })
    expect(s.source).toEqual({ goal: 'custom' })
  })

  it('tiene il file caricato anche se la sorgente è un predefinito', () => {
    const s = normalizeAudioSettings({
      custom: { goal: 'sirena.mp3' },
      source: { goal: 'tv-horn' },
    })
    expect(s.custom).toEqual({ goal: 'sirena.mp3' })
    expect(s.source).toEqual({ goal: 'tv-horn' })
    expect(resolveSource(s, 'goal')).toBe('tv-horn')
  })

  it('scarta sorgenti non valide e suoni sconosciuti', () => {
    const s = normalizeAudioSettings({
      custom: { goal: '', nonEsiste: 'x.mp3', timeout: 42 },
      source: {
        goal: 'custom',
        periodEnd: 'boh',
        timeout: 7,
        nonEsiste: 'brass-horn',
        shiftChange: 'brass-horn',
      },
    })
    expect(s.custom).toEqual({})
    expect(s.source).toEqual({ shiftChange: 'brass-horn' })
  })

  it('non condivide oggetti con DEFAULT_AUDIO', () => {
    const s = normalizeAudioSettings({})
    s.source.goal = 'brass-horn'
    s.custom.goal = 'x'
    expect(DEFAULT_AUDIO.source).toEqual({})
    expect(DEFAULT_AUDIO.custom).toEqual({})
  })
})
