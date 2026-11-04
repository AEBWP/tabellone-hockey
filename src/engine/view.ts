import { countdownRemainingMs, formatClock, gameTimeMs, periodRemainingMs } from './clock'
import { advance, isClockRunning, isOvertime } from './game'
import { countsForStrength, skatersOnIce } from './penalties'
import { shootoutWinner } from './shootout'
import { TEAM_IDS, type GameState, type Phase, type PenaltyKind, type TeamId } from './types'

/** Tutto ciò che serve per disegnare tabellone e console all'istante `now`. */
export interface GameView {
  phase: Phase
  period: number
  /** `regular` = tempo regolamentare, `overtime` = supplementare. */
  periodKind: 'regular' | 'overtime'
  /** Numero del supplementare (1, 2, …), 0 nei tempi regolamentari. */
  overtimeNumber: number
  clockMs: number
  clockText: string
  clockRunning: boolean
  intermission: { remainingMs: number; text: string } | null
  timeout: { team: TeamId; remainingMs: number; text: string } | null
  teams: Record<TeamId, TeamView>
  /** Squadra in superiorità numerica, se c'è. */
  powerPlay: TeamId | null
  shootout: ShootoutView | null
}

export interface TeamView {
  name: string
  shortName: string
  color: string
  /** Punteggio da mostrare (include il gol del vincitore ai rigori). */
  score: number
  goals: number
  shots: number
  timeoutsLeft: number
  /** Giocatori di movimento in pista. */
  skaters: number
  /** Penalità in corso (le più vicine alla fine per prime), poi quelle in coda. */
  penalties: PenaltyView[]
}

export interface PenaltyView {
  id: number
  player: string
  kind: PenaltyKind
  remainingMs: number
  text: string
  queued: boolean
  /** False per la cattiva condotta: il giocatore è fuori ma la squadra no. */
  countsForStrength: boolean
}

export interface ShootoutView {
  rounds: number
  home: boolean[]
  away: boolean[]
  winner: TeamId | null
}

export function deriveView(state: GameState, now: number): GameView {
  const s = advance(state, now)
  const gameMs = gameTimeMs(s.clock, now)
  const overtime = isOvertime(s)
  const baseSkaters = overtime ? s.rules.overtime.skaters : s.rules.skaters
  const skaters = skatersOnIce(s.penalties, baseSkaters)
  const clockMs = periodRemainingMs(s.clock, now)
  const tenths = s.rules.tenthsBelowMs

  const winner = s.shootout ? shootoutWinner(s.shootout, s.rules.shootout.rounds) : null

  const teams = {} as Record<TeamId, TeamView>
  for (const id of TEAM_IDS) {
    const t = s.teams[id]
    const penalties = s.penalties
      .filter((p) => p.team === id && p.status !== 'ended')
      .map<PenaltyView>((p) => {
        const remainingMs = p.status === 'active' ? p.endMs! - gameMs : p.durationMs
        return {
          id: p.id,
          player: p.player,
          kind: p.kind,
          remainingMs,
          text: formatClock(remainingMs, 0),
          queued: p.status === 'queued',
          countsForStrength: countsForStrength(p.kind),
        }
      })
      .sort((a, b) => Number(a.queued) - Number(b.queued) || a.remainingMs - b.remainingMs)

    teams[id] = {
      name: t.name,
      shortName: t.shortName,
      color: t.color,
      score: t.goals + (winner === id ? 1 : 0),
      goals: t.goals,
      shots: t.shots,
      timeoutsLeft: Math.max(0, s.rules.timeoutsPerTeam - t.timeoutsUsed),
      skaters: skaters[id],
      penalties,
    }
  }

  const powerPlay: TeamId | null =
    (s.phase !== 'play' && s.phase !== 'ready') || skaters.home === skaters.away
      ? null
      : skaters.home > skaters.away
        ? 'home'
        : 'away'

  const intermissionMs = s.intermission ? countdownRemainingMs(s.intermission, now) : 0
  const timeoutMs = s.timeout ? countdownRemainingMs(s.timeout.clock, now) : 0

  return {
    phase: s.phase,
    period: s.period,
    periodKind: overtime ? 'overtime' : 'regular',
    overtimeNumber: overtime ? s.period - s.rules.periods : 0,
    clockMs,
    clockText: formatClock(clockMs, tenths),
    clockRunning: isClockRunning(s),
    intermission: s.intermission
      ? { remainingMs: intermissionMs, text: formatClock(intermissionMs, 0) }
      : null,
    timeout: s.timeout
      ? { team: s.timeout.team, remainingMs: timeoutMs, text: formatClock(timeoutMs, 0) }
      : null,
    teams,
    powerPlay,
    shootout: s.shootout
      ? {
          rounds: s.rules.shootout.rounds,
          home: [...s.shootout.home],
          away: [...s.shootout.away],
          winner,
        }
      : null,
  }
}
