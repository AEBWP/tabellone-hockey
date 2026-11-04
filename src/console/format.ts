import {
  formatClock,
  type GameEvent,
  type PenaltyKind,
  type Rules,
  type TeamState,
} from '../engine'

/** Durata breve per i pulsanti: "2′", "1′30″", "10′". */
export function durationLabel(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (seconds === 0) return `${minutes}′`
  if (minutes === 0) return `${seconds}″`
  return `${minutes}′${String(seconds).padStart(2, '0')}″`
}

export const PENALTY_NAMES: Record<PenaltyKind, string> = {
  minor: 'Minore',
  'double-minor': 'Doppia minore',
  major: 'Maggiore',
  misconduct: 'Cattiva condotta',
}

export function penaltyButtonLabel(kind: PenaltyKind, rules: Rules): string {
  const minor = durationLabel(rules.penaltyMs.minor)
  switch (kind) {
    case 'minor':
      return minor
    case 'double-minor':
      return `${minor}+${minor}`
    case 'major':
      return durationLabel(rules.penaltyMs.major)
    case 'misconduct':
      return durationLabel(rules.penaltyMs.misconduct)
  }
}

/** Periodo per il registro eventi: "1° T", "SUPPL.", "SUPPL. 2". */
export function shortPeriod(period: number, rules: Rules): string {
  if (period <= rules.periods) return `${period}° T`
  const ot = period - rules.periods
  return ot > 1 ? `SUPPL. ${ot}` : 'SUPPL.'
}

/** Riga del registro eventi. */
export function describeEvent(
  event: GameEvent,
  teams: Record<'home' | 'away', TeamState>,
  rules: Rules,
): { when: string; text: string } {
  const when = `${shortPeriod(event.period, rules)} ${formatClock(event.periodElapsedMs, 0)}`
  const team = teams[event.team].name
  if (event.type === 'goal') {
    const extra = event.powerPlay ? ' (superiorità)' : event.shortHanded ? ' (inferiorità)' : ''
    const who = event.player ? ` #${event.player}` : ''
    return { when, text: `Gol ${team}${who}${extra}` }
  }
  return { when, text: `${PENALTY_NAMES[event.kind]} #${event.player} ${team}` }
}
