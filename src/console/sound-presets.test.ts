import { describe, expect, it } from 'vitest'
import { DEFAULT_AUDIO, normalizeAudioSettings, resolveSource, sourcesInUse } from './audio.svelte'
import { SOUND_IDS } from './sound-events'
import { SOUND_PRESETS, findPreset, presetUrl } from './sound-presets'

describe('SOUND_PRESETS', () => {
  it('ha id unici, diversi da synth e custom', () => {
    const ids = SOUND_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('synth')
    expect(ids).not.toContain('custom')
  })

  it('suggerisce solo suoni esistenti e ha file OGG', () => {
    for (const p of SOUND_PRESETS) {
      expect(p.file).toMatch(/\.ogg$/)
      for (const id of p.suggested) expect(SOUND_IDS).toContain(id)
    }
  })

  it('trova i predefiniti e ne costruisce il percorso relativo', () => {
    const p = findPreset('bell')!
    expect(p.name).toBe('Campanella')
    expect(presetUrl(p)).toBe('./sounds/bell.ogg')
    expect(findPreset('inesistente')).toBeUndefined()
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

describe('sourcesInUse', () => {
  it('elenca solo i suoni che non usano il sintetizzato', () => {
    const settings = {
      custom: { goal: 'sirena.mp3', timeout: 'vecchio.wav' },
      source: { timeout: 'synth', periodEnd: 'buzzer-long', shiftChange: 'boh' },
    }
    expect(sourcesInUse(settings)).toEqual([
      ['goal', 'custom'],
      ['periodEnd', 'buzzer-long'],
    ])
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
      source: { goal: 'goal-siren' },
    })
    expect(s.custom).toEqual({ goal: 'sirena.mp3' })
    expect(s.source).toEqual({ goal: 'goal-siren' })
    expect(resolveSource(s, 'goal')).toBe('goal-siren')
  })

  it('scarta sorgenti non valide e suoni sconosciuti', () => {
    const s = normalizeAudioSettings({
      custom: { goal: '', nonEsiste: 'x.mp3', timeout: 42 },
      source: {
        goal: 'custom',
        periodEnd: 'boh',
        timeout: 7,
        nonEsiste: 'bell',
        shiftChange: 'bell',
      },
    })
    expect(s.custom).toEqual({})
    expect(s.source).toEqual({ shiftChange: 'bell' })
  })

  it('non condivide oggetti con DEFAULT_AUDIO', () => {
    const s = normalizeAudioSettings({})
    s.source.goal = 'bell'
    s.custom.goal = 'x'
    expect(DEFAULT_AUDIO.source).toEqual({})
    expect(DEFAULT_AUDIO.custom).toEqual({})
  })
})
