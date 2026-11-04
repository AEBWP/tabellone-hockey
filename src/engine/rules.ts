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

/** Limiti ragionevoli per ogni valore, usati per controllare le regole personalizzate. */
export const RULE_LIMITS = {
  periods: { min: 1, max: 10 },
  periodMs: { min: SEC, max: 60 * MIN },
  intermissionMs: { min: 0, max: 60 * MIN },
  skaters: { min: 3, max: 6 },
  maxPenalizedOnIce: { min: 1, max: 3 },
  overtimePeriodMs: { min: SEC, max: 60 * MIN },
  overtimeMaxPeriods: { min: 0, max: 10 },
  overtimeSkaters: { min: 3, max: 6 },
  overtimeBreakMs: { min: 0, max: 60 * MIN },
  shootoutRounds: { min: 1, max: 10 },
  penaltyMs: { min: 10 * SEC, max: 30 * MIN },
  timeoutMs: { min: 5 * SEC, max: 5 * MIN },
  timeoutsPerTeam: { min: 0, max: 5 },
} as const

/** Controlla le regole: restituisce l'elenco dei problemi (vuoto se tutto va bene). */
export function validateRules(r: Rules): string[] {
  const errors: string[] = []
  const check = (value: number, limit: { min: number; max: number }, message: string) => {
    if (!Number.isFinite(value) || value < limit.min || value > limit.max) errors.push(message)
  }
  const L = RULE_LIMITS
  const minutes = (ms: number) => (ms >= MIN ? `${ms / MIN} min` : `${ms / SEC} s`)

  check(r.periods, L.periods, `I periodi devono essere da ${L.periods.min} a ${L.periods.max}.`)
  if (!Number.isInteger(r.periods)) errors.push('Il numero di periodi deve essere intero.')
  check(r.periodMs, L.periodMs, `La durata del periodo va da 1 s a ${minutes(L.periodMs.max)}.`)
  check(
    r.intermissionMs,
    L.intermissionMs,
    `L'intervallo va da 0 a ${minutes(L.intermissionMs.max)}.`,
  )
  check(r.skaters, L.skaters, 'I giocatori in pista devono essere da 3 a 6.')
  check(r.maxPenalizedOnIce, L.maxPenalizedOnIce, 'I penalizzati contemporanei vanno da 1 a 3.')

  if (r.overtime.enabled) {
    check(
      r.overtime.periodMs,
      L.overtimePeriodMs,
      `Il supplementare va da 1 s a ${minutes(L.overtimePeriodMs.max)}.`,
    )
    check(
      r.overtime.maxPeriods,
      L.overtimeMaxPeriods,
      'I supplementari vanno da 0 (illimitati) a 10.',
    )
    check(r.overtime.skaters, L.overtimeSkaters, 'I giocatori nel supplementare vanno da 3 a 6.')
    check(
      r.overtime.breakMs,
      L.overtimeBreakMs,
      'La pausa prima del supplementare va da 0 a 60 min.',
    )
  }
  if (r.shootout.enabled) {
    check(r.shootout.rounds, L.shootoutRounds, 'I tiratori ai rigori vanno da 1 a 10.')
  }

  check(r.penaltyMs.minor, L.penaltyMs, 'La penalità minore va da 10 s a 30 min.')
  check(r.penaltyMs.major, L.penaltyMs, 'La penalità maggiore va da 10 s a 30 min.')
  check(r.penaltyMs.misconduct, L.penaltyMs, 'La cattiva condotta va da 10 s a 30 min.')
  check(r.timeoutMs, L.timeoutMs, 'Il timeout va da 5 s a 5 min.')
  check(r.timeoutsPerTeam, L.timeoutsPerTeam, 'I timeout per squadra vanno da 0 a 5.')
  return errors
}

/** Descrizione breve di un regolamento, es. "3 × 20′, supplementare 5′, rigori". */
export function describeRules(r: Rules): string {
  const len = (ms: number) => {
    const s = Math.round(ms / SEC)
    return s % 60 === 0 ? `${s / 60}′` : `${Math.floor(s / 60)}′${String(s % 60).padStart(2, '0')}″`
  }
  const parts = [`${r.periods} × ${len(r.periodMs)}`]
  if (r.overtime.enabled) {
    const many = r.overtime.maxPeriods === 0 ? ' a oltranza' : ''
    parts.push(`supplementare ${len(r.overtime.periodMs)}${many}`)
  }
  if (r.shootout.enabled) parts.push('rigori')
  if (!r.overtime.enabled && !r.shootout.enabled) parts.push('pareggio possibile')
  return parts.join(', ')
}
