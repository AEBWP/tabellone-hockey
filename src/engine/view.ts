import { countdownRemainingMs, formatClock, gameTimeMs, periodRemainingMs } from './clock'
import { advance, isClockRunning, isOvertime, isPregame } from './game'
import { countsForStrength, skatersOnIce } from './penalties'
import { shootoutWinner } from './shootout'
import {
  TEAM_IDS,
  type GameState,
  type Language,
  type Phase,
  type PenaltyKind,
  type TeamId,
} from './types'

/** Tutto ciò che serve per disegnare tabellone e console all'istante `now`. */
export interface GameView {
  phase: Phase
  /**
   * Partita non ancora iniziata (tempo mai avviato, nessun evento): il
   * tabellone mostra la presentazione “squadra A VS squadra B”.
   */
  pregame: boolean
  period: number
  /** `regular` = tempo regolamentare, `overtime` = supplementare. */
  periodKind: 'regular' | 'overtime'
  /** Numero del supplementare (1, 2, …), 0 nei tempi regolamentari. */
  overtimeNumber: number
  /** Periodi regolamentari (es. 3): servono per chiamarli "terzi" o "tempi". */
  regularPeriods: number
  /** Mostrare i tiri in porta (si attiva nel regolamento). */
  showShots: boolean
  /** Solo il cronometro: niente squadre né punti (tornei a più campi). */
  clockOnly: boolean
  /** Lingua delle scritte del tabellone. */
  language: Language
  clockMs: number
  clockText: string
  clockRunning: boolean
  intermission: { remainingMs: number; text: string } | null
  timeout: { team: TeamId; remainingMs: number; text: string } | null
  teams: Record<TeamId, TeamView>
  /** Squadra in superiorità numerica, se c'è. */
  powerPlay: TeamId | null
  shootout: ShootoutView | null
  /**
   * Casa a destra, come la vede l'operatore in console: lati invertiti a mano
   * e/o cambio campo automatico a ogni periodo. I tabelloni lo seguono (o lo
   * rovesciano, se sono girati verso la console): vedi `orientView`.
   */
  sidesSwapped: boolean
}

export interface TeamView {
  /** Squadra vera: dopo `orientView` a sinistra ("home") può esserci quella ospite. */
  id: TeamId
  name: string
  shortName: string
  color: string
  /** Logo da mostrare: null se la squadra non ne ha o se i loghi sono nascosti. */
  logo: string | null
  /** Punteggio da mostrare (include il gol del vincitore ai rigori). */
  score: number
  goals: number
  /**
   * Gol segnati con il pulsante GOL (non le correzioni ±1): quando cresce, il
   * tabellone fa partire l'animazione del gol.
   */
  goalEvents: number
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
      id,
      name: t.name,
      shortName: t.shortName,
      color: t.color,
      logo: s.showLogos ? t.logo : null,
      score: t.goals + (winner === id ? 1 : 0),
      goals: t.goals,
      goalEvents: s.events.filter((e) => e.type === 'goal' && e.team === id).length,
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
    pregame: isPregame(s),
    period: s.period,
    periodKind: overtime ? 'overtime' : 'regular',
    overtimeNumber: overtime ? s.period - s.rules.periods : 0,
    regularPeriods: s.rules.periods,
    showShots: s.rules.showShots === true,
    clockOnly: s.rules.clockOnly === true,
    language: s.boardLanguage,
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
    sidesSwapped: consoleSidesSwapped(s),
  }
}

/**
 * Lati invertiti in console. Con il cambio campo automatico si inverte a ogni
 * periodo pari. Il cambio avviene a fine periodo, all'inizio dell'intervallo
 * (il periodo è già il successivo): l'operatore ha tutta la pausa per abituarsi
 * e non si gira niente quando riparte il gioco. A fine partita il periodo resta
 * l'ultimo giocato, quindi i lati non cambiano.
 */
export function consoleSidesSwapped(s: GameState): boolean {
  const manual = s.sidesSwapped === true
  if (!s.rules.switchSides) return manual
  return manual !== (Math.max(1, s.period) % 2 === 0)
}

const other = (team: TeamId): TeamId => (team === 'home' ? 'away' : 'home')

/**
 * Vista con le squadre scambiate di lato, per i tabelloni: quello che il
 * disegno mette a sinistra ("home") diventa l'altra squadra. Ogni squadra si
 * porta dietro punti, tiri, penalità, timeout e rigori.
 */
export function orientView(view: GameView, flip: boolean): GameView {
  if (!flip) return view
  return {
    ...view,
    teams: { home: view.teams.away, away: view.teams.home },
    timeout: view.timeout ? { ...view.timeout, team: other(view.timeout.team) } : null,
    powerPlay: view.powerPlay ? other(view.powerPlay) : null,
    shootout: view.shootout
      ? {
          ...view.shootout,
          home: view.shootout.away,
          away: view.shootout.home,
          winner: view.shootout.winner ? other(view.shootout.winner) : null,
        }
      : null,
  }
}
