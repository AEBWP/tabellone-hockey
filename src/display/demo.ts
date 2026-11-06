import { apply, createGame, rulesFromPreset, type Command, type GameState } from '../engine'

/**
 * Scene dimostrative del tabellone, per provarne la grafica senza la console.
 * Si apre con `display.html?demo` e si cambia scena con i tasti indicati.
 */

const SEC = 1_000
const MIN = 60 * SEC

/** Logo dimostrativo: uno scudo con l'iniziale, disegnato in SVG. */
function demoLogo(letter: string, fill: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110">
    <path d="M50 4 L94 18 V54 C94 80 74 98 50 106 C26 98 6 80 6 54 V18 Z" fill="${accent}"/>
    <path d="M50 12 L86 24 V54 C86 76 70 91 50 98 C30 91 14 76 14 54 V24 Z" fill="${fill}"/>
    <text x="50" y="72" font-family="Arial Black, Arial, sans-serif" font-size="52"
      font-weight="900" text-anchor="middle" fill="${accent}">${letter}</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const DEMO_TEAMS = {
  home: {
    name: 'Castori Valle',
    shortName: 'CASTORI',
    color: '#d62839',
    logo: demoLogo('C', '#d62839', '#ffffff'),
  },
  away: {
    name: 'Lupi del Lago',
    shortName: 'LUPI',
    color: '#1f6feb',
    logo: demoLogo('L', '#0b2f6b', '#9cc3ea'),
  },
}

function run(
  commands: Command[],
  at: number,
  start = createGame(rulesFromPreset('senior'), DEMO_TEAMS),
) {
  let s = start
  for (const c of commands) s = apply(s, c, at)
  return s
}

/** Prima del via i comandi di gioco sono bloccati: si avvia e si ferma il tempo. */
const KICKOFF: Command[] = [{ type: 'startClock' }, { type: 'stopClock' }]

const toThirdPeriod: Command[] = [
  ...KICKOFF,
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
    key: '0',
    label: 'Prima della partita (P per iniziare)',
    build(now) {
      return run([], now)
    },
  },
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
      return run([...KICKOFF, { type: 'goal', team: 'home' }, { type: 'endPeriod' }], now - 2 * MIN)
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
