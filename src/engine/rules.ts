/**
 * Regole di gioco configurabili.
 *
 * Tutte le durate sono in millisecondi. I preset sono solo punti di partenza:
 * l'operatore può modificarne ogni valore.
 */

export interface OvertimeRules {
  /** Se false, a fine tempi regolamentari in parità si passa ai rigori (se attivi) o al pareggio. */
  enabled: boolean
  /** Durata di ogni periodo supplementare. */
  periodMs: number
  /** Numero massimo di supplementari; 0 = illimitati (playoff). */
  maxPeriods: number
  /** Giocatori di movimento per squadra nel supplementare (es. 3 per il 3 contro 3). */
  skaters: number
  /** Pausa prima di ogni supplementare; 0 = nessuna pausa. */
  breakMs: number
}

export interface ShootoutRules {
  enabled: boolean
  /** Tiratori per squadra prima della "morte improvvisa". */
  rounds: number
}

export interface PenaltyDurations {
  /** Penalità minore (la doppia minore vale il doppio). */
  minor: number
  /** Penalità maggiore. */
  major: number
  /** Cattiva condotta: il giocatore esce ma la squadra non resta in inferiorità. */
  misconduct: number
}

export interface Rules {
  /** Periodi regolamentari. */
  periods: number
  periodMs: number
  /** Intervallo tra i periodi regolamentari; 0 = nessun intervallo automatico. */
  intermissionMs: number
  /** Giocatori di movimento per squadra (portiere escluso). */
  skaters: number
  /** Massimo di giocatori penalizzati contemporaneamente per squadra (le altre penalità restano in coda). */
  maxPenalizedOnIce: number
  overtime: OvertimeRules
  shootout: ShootoutRules
  penaltyMs: PenaltyDurations
  timeoutMs: number
  timeoutsPerTeam: number
  /** Sotto questa soglia il tempo mostra i decimi; 0 = mai. */
  tenthsBelowMs: number
}

export interface RulesPreset {
  id: string
  name: string
  description: string
  rules: Rules
}

const SEC = 1_000
const MIN = 60 * SEC

const COMMON = {
  skaters: 5,
  maxPenalizedOnIce: 2,
  penaltyMs: { minor: 2 * MIN, major: 5 * MIN, misconduct: 10 * MIN },
  timeoutMs: 30 * SEC,
  timeoutsPerTeam: 1,
  tenthsBelowMs: MIN,
} satisfies Partial<Rules>

export const PRESETS: readonly RulesPreset[] = [
  {
    id: 'senior',
    name: 'Senior',
    description: '3 × 20′, supplementare 3 contro 3 da 5′, poi rigori',
    rules: {
      ...COMMON,
      periods: 3,
      periodMs: 20 * MIN,
      intermissionMs: 15 * MIN,
      overtime: { enabled: true, periodMs: 5 * MIN, maxPeriods: 1, skaters: 3, breakMs: 0 },
      shootout: { enabled: true, rounds: 3 },
    },
  },
  {
    id: 'senior-playoff',
    name: 'Senior playoff',
    description: '3 × 20′, supplementari da 20′ a oltranza, niente rigori',
    rules: {
      ...COMMON,
      periods: 3,
      periodMs: 20 * MIN,
      intermissionMs: 15 * MIN,
      overtime: { enabled: true, periodMs: 20 * MIN, maxPeriods: 0, skaters: 5, breakMs: 15 * MIN },
      shootout: { enabled: false, rounds: 3 },
    },
  },
  {
    id: 'giovanili',
    name: 'Giovanili',
    description: '3 × 15′, nessun supplementare',
    rules: {
      ...COMMON,
      periods: 3,
      periodMs: 15 * MIN,
      intermissionMs: 10 * MIN,
      overtime: { enabled: false, periodMs: 5 * MIN, maxPeriods: 1, skaters: 3, breakMs: 0 },
      shootout: { enabled: false, rounds: 3 },
    },
  },
  {
    id: 'amatori',
    name: 'Amatori / allenamento',
    description: '3 × 15′, intervalli brevi, nessun supplementare',
    rules: {
      ...COMMON,
      periods: 3,
      periodMs: 15 * MIN,
      intermissionMs: 5 * MIN,
      overtime: { enabled: false, periodMs: 5 * MIN, maxPeriods: 1, skaters: 3, breakMs: 0 },
      shootout: { enabled: false, rounds: 3 },
    },
  },
]

export const DEFAULT_RULES: Rules = PRESETS[0].rules

/** Copia indipendente delle regole di un preset, da poter modificare. */
export function rulesFromPreset(id: string): Rules {
  const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[0]
  return structuredClone(preset.rules)
}

/** Durata del periodo `period` (1-based): regolamentare o supplementare. */
export function periodLengthMs(rules: Rules, period: number): number {
  return period <= rules.periods ? rules.periodMs : rules.overtime.periodMs
}
