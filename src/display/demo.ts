import { apply, createGame, rulesFromPreset, type Command, type GameState } from '../engine'

/**
 * Scene dimostrative del tabellone, per provarne la grafica senza la console.
 * Si apre con `display.html?demo` e si cambia scena con i tasti indicati.
 */

const SEC = 1_000
const MIN = 60 * SEC

const TEAMS = {
  home: { name: 'Aquile Valle', shortName: 'AQUILE', color: '#d62839' },
  away: { name: 'Lupi del Lago', shortName: 'LUPI', color: '#1f6feb' },
}

function run(
  commands: Command[],
  at: number,
  start = createGame(rulesFromPreset('senior'), TEAMS),
) {
  let s = start
  for (const c of commands) s = apply(s, c, at)
  return s
}

const toThirdPeriod: Command[] = [
  { type: 'endPeriod' },
  { type: 'endIntermission' },
  { type: 'endPeriod' },
  { type: 'endIntermission' },
]

export interface DemoScene {
  key: string
  label: string
  build(now: number): GameState
}

export const DEMO_SCENES: DemoScene[] = [
  {
    key: '1',
    label: 'Gioco con penalità',
    build(now) {
      // Tutto è successo 40 secondi fa: il tempo e la penalità stanno scorrendo.
      return run(
        [
          { type: 'endPeriod' },
          { type: 'endIntermission' },
          { type: 'goal', team: 'home' },
          { type: 'goal', team: 'home' },
          { type: 'goal', team: 'away' },
          { type: 'shot', team: 'home', delta: 17 },
          { type: 'shot', team: 'away', delta: 12 },
          { type: 'setClock', remainingMs: 12 * MIN + 34 * SEC },
          { type: 'startClock' },
          { type: 'penalty', team: 'away', player: '7', kind: 'minor' },
          { type: 'penalty', team: 'away', player: '22', kind: 'misconduct' },
        ],
        now - 40 * SEC,
      )
    },
  },
  {
    key: '2',
    label: '5 contro 3 con penalità in coda',
    build(now) {
      return run(
        [
          { type: 'startClock' },
          { type: 'penalty', team: 'home', player: '4', kind: 'minor' },
          { type: 'penalty', team: 'home', player: '19', kind: 'major' },
          { type: 'penalty', team: 'home', player: '88', kind: 'minor' },
        ],
        now,
      )
    },
  },
  {
    key: '3',
    label: 'Ultimo minuto (decimi)',
    build(now) {
      return run(
        [
          ...toThirdPeriod,
          { type: 'goal', team: 'away' },
          { type: 'goal', team: 'home' },
          { type: 'goal', team: 'home' },
          { type: 'setClock', remainingMs: 48 * SEC },
          { type: 'startClock' },
        ],
        now,
      )
    },
  },
  {
    key: '4',
    label: 'Timeout',
    build(now) {
      return run(
        [{ type: 'startClock' }, { type: 'goal', team: 'away' }, { type: 'timeout', team: 'home' }],
        now,
      )
    },
  },
  {
    key: '5',
    label: 'Intervallo',
    build(now) {
      return run([{ type: 'goal', team: 'home' }, { type: 'endPeriod' }], now - 2 * MIN)
    },
  },
  {
    key: '6',
    label: 'Supplementare 3 contro 3',
    build(now) {
      return run(
        [
          ...toThirdPeriod,
          { type: 'endPeriod' },
          { type: 'startClock' },
          { type: 'penalty', team: 'home', player: '10', kind: 'minor' },
        ],
        now,
      )
    },
  },
  {
    key: '7',
    label: 'Rigori',
    build(now) {
      return run(
        [
          ...toThirdPeriod,
          { type: 'goal', team: 'home' },
          { type: 'goal', team: 'away' },
          { type: 'endPeriod' },
          { type: 'endPeriod' },
          { type: 'shootoutAttempt', team: 'home', scored: true },
          { type: 'shootoutAttempt', team: 'away', scored: false },
          { type: 'shootoutAttempt', team: 'home', scored: false },
        ],
        now,
      )
    },
  },
  {
    key: '8',
    label: 'Finale',
    build(now) {
      return run(
        [
          ...toThirdPeriod,
          { type: 'goal', team: 'home' },
          { type: 'goal', team: 'home' },
          { type: 'goal', team: 'away' },
          { type: 'goal', team: 'home' },
          { type: 'endPeriod' },
        ],
        now,
      )
    },
  },
]

/** Tasti per i gol durante la demo. */
export const DEMO_GOAL_KEYS: Record<string, 'home' | 'away'> = { g: 'home', h: 'away' }
