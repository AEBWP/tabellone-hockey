import { describe, expect, it } from 'vitest'
import { createGame, deriveView, LANGUAGES, PRESETS, validateRules } from '../engine'
import { rulesFromPreset } from '../engine/rules'
import { STYLE_INFO } from '../scoreboard/styles'
import { PENALTY_NAMES } from '../console/format'
import { SHORTCUTS } from '../console/shortcuts'
import { SOUND_LABELS } from '../console/sound-events'
import { BOARD_TEXT, phaseLabel } from './board'
import { CONSOLE_TEXT, ROWS } from './console'
import { t, ui } from './ui.svelte'

/** Il testo di tutti i file della console e delle finestre dell'operatore. */
const SOURCES = import.meta.glob(
  [
    '../console/**/*.{ts,svelte}',
    '../setup/**/*.{ts,svelte}',
    '../display/**/*.{ts,svelte}',
    './*.ts',
    '!**/*.test.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

/** Le frasi scritte come t('…') (o tr('…')) nei file. */
function literalKeys(): string[] {
  const keys = new Set<string>()
  for (const text of Object.values(SOURCES)) {
    for (const m of text.matchAll(/\btr?\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1])
  }
  return [...keys]
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('traduzioni della console', () => {
  const known = new Set(ROWS.map((r) => r[0]))

  it('ogni frase usata nella console ha la traduzione', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20)
    expect(literalKeys().length).toBeGreaterThan(150)
    const missing = literalKeys().filter((k) => !known.has(k))
    expect(missing).toEqual([])
  })

  it('ogni testo che arriva da altri moduli ha la traduzione', () => {
    const dynamic = [
      ...Object.values(PENALTY_NAMES),
      ...SHORTCUTS.flatMap((s) => [s.description, ...s.keys.filter((k) => k.length > 2)]),
      ...Object.values(SOUND_LABELS).flatMap((s) => [s.name, s.description]),
      ...Object.values(STYLE_INFO).flatMap((s) => [s.name, s.description]),
      ...PRESETS.map((p) => p.name),
    ]
    expect(dynamic.filter((k) => !known.has(k))).toEqual([])
  })

  it('tutti i messaggi di errore del regolamento hanno la traduzione', () => {
    const bad = rulesFromPreset('senior')
    Object.assign(bad, {
      periods: 1.5,
      periodMs: 0,
      intermissionMs: -1,
      skaters: 9,
      maxPenalizedOnIce: 9,
      timeoutMs: 0,
      timeoutsPerTeam: 9,
    })
    bad.overtime = {
      ...bad.overtime,
      enabled: true,
      periodMs: 0,
      maxPeriods: 99,
      skaters: 9,
      breakMs: -1,
    }
    bad.shootout = { ...bad.shootout, enabled: true, rounds: 0 }
    bad.penaltyMs = { ...bad.penaltyMs, minor: 0, major: 0, misconduct: 0 }
    const errors = validateRules(bad)
    expect(errors.length).toBeGreaterThan(12)
    expect(errors.filter((e) => !known.has(e))).toEqual([])
  })

  it('nessuna frase è ripetuta e i segnaposto coincidono in ogni lingua', () => {
    expect(new Set(ROWS.map((r) => r[0])).size).toBe(ROWS.length)
    for (const row of ROWS) {
      for (const text of row.slice(1)) {
        expect(text.trim(), row[0]).not.toBe('')
        expect(placeholders(text), `${row[0]} → ${text}`).toEqual(placeholders(row[0]))
      }
    }
  })

  it('traduce e inserisce i valori; senza traduzione resta il testo italiano', () => {
    expect(ui.lang).toBe('it')
    expect(t('Gol {team}', { team: 'LUPI' })).toBe('Gol LUPI')
    ui.set('de')
    try {
      expect(t('Gol {team}', { team: 'LUPI' })).toBe('Tor LUPI')
      expect(t('frase sconosciuta')).toBe('frase sconosciuta')
      expect(CONSOLE_TEXT.de.get('Annulla')).toBe('Abbrechen')
    } finally {
      ui.set('it')
    }
  })
})

describe('scritte del tabellone', () => {
  it('ogni lingua ha tutte le scritte', () => {
    const keys = Object.keys(BOARD_TEXT.it).sort()
    for (const lang of LANGUAGES) expect(Object.keys(BOARD_TEXT[lang]).sort()).toEqual(keys)
  })

  it('i nomi dei periodi usano i termini di ogni paese', () => {
    const view = deriveView(createGame(), 0)
    const label = (language: (typeof LANGUAGES)[number]) => phaseLabel({ ...view, language })
    expect(label('it')).toBe('1° TEMPO')
    expect(label('en')).toBe('1ST PERIOD')
    expect(label('de')).toBe('1. DRITTEL')
    expect(label('fr')).toBe('1ER TIERS')
    expect(BOARD_TEXT.it.goal).toBe('GOAL')
    expect(BOARD_TEXT.it.vs).toBe('VS')
    expect(BOARD_TEXT.de.goal).toBe('TOR')
  })

  it('supplementari numerati', () => {
    const ot = { period: 5, periodKind: 'overtime', overtimeNumber: 2, regularPeriods: 3 } as const
    expect(BOARD_TEXT.it.period(ot)).toBe('SUPPLEMENTARE 2')
    expect(BOARD_TEXT.it.period({ ...ot, period: 4, overtimeNumber: 1 })).toBe('SUPPLEMENTARE')
  })
})
