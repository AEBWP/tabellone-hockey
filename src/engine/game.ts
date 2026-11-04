import { countdownEndsAt, gameTimeMs, periodElapsedMs, periodEndsAt } from './clock'
import {
  addPenalty,
  applyPowerPlayGoal,
  endPenalty,
  penaltyDurationMs,
  removePenalty,
  settlePenalties,
  shiftActivePenalties,
  skatersOnIce,
} from './penalties'
import { DEFAULT_RULES, periodLengthMs, type Rules } from './rules'
import { shootoutWinner } from './shootout'
import {
  opponent,
  type GameState,
  type PenaltyKind,
  type TeamId,
  type TeamSetup,
  type TeamState,
} from './types'

/** Comandi che la console può inviare al motore. */
export type Command =
  | { type: 'startClock' }
  | { type: 'stopClock' }
  | { type: 'toggleClock' }
  /** Correzione del tempo rimanente nel periodo. Le penalità non cambiano. */
  | { type: 'setClock'; remainingMs: number }
  | { type: 'goal'; team: TeamId; player?: string }
  /** Correzione manuale del punteggio (nessun effetto su penalità o eventi). */
  | { type: 'setScore'; team: TeamId; goals: number }
  | { type: 'shot'; team: TeamId; delta: number }
  | { type: 'penalty'; team: TeamId; player: string; kind: PenaltyKind }
  /** Chiude in anticipo una penalità. */
  | { type: 'endPenalty'; id: number }
  /** Elimina una penalità inserita per errore. */
  | { type: 'removePenalty'; id: number }
  | { type: 'timeout'; team: TeamId }
  | { type: 'endTimeout' }
  /** Termina subito l'intervallo: il periodo successivo è pronto. */
  | { type: 'endIntermission' }
  /** Termina subito il periodo in corso. */
  | { type: 'endPeriod' }
  | { type: 'shootoutAttempt'; team: TeamId; scored: boolean }
  | { type: 'undoShootoutAttempt'; team: TeamId }
  | { type: 'endGame' }
  | { type: 'setTeam'; team: TeamId; setup: Partial<TeamSetup> }
  | { type: 'newGame'; rules?: Rules; teams?: Partial<Record<TeamId, TeamSetup>> }

export const DEFAULT_TEAMS: Record<TeamId, TeamSetup> = {
  home: { name: 'Casa', shortName: 'CASA', color: '#d62839' },
  away: { name: 'Ospiti', shortName: 'OSP', color: '#1f6feb' },
}

function team(setup: TeamSetup): TeamState {
  return { ...setup, goals: 0, shots: 0, timeoutsUsed: 0 }
}

export function createGame(
  rules: Rules = DEFAULT_RULES,
  teams: Partial<Record<TeamId, TeamSetup>> = {},
): GameState {
  const periodMs = periodLengthMs(rules, 1)
  return {
    rules: structuredClone(rules),
    teams: {
      home: team(teams.home ?? DEFAULT_TEAMS.home),
      away: team(teams.away ?? DEFAULT_TEAMS.away),
    },
    phase: 'ready',
    period: 1,
    clock: { baseMs: 0, runningSince: null, periodStartMs: 0, periodEndMs: periodMs },
    intermission: null,
    timeout: null,
    penalties: [],
    events: [],
    shootout: null,
    nextId: 1,
  }
}

export function isOvertime(state: GameState): boolean {
  return state.period > state.rules.periods
}

export function isClockRunning(state: GameState): boolean {
  return state.clock.runningSince !== null
}

function baseSkaters(state: GameState): number {
  return isOvertime(state) ? state.rules.overtime.skaters : state.rules.skaters
}

function stopClockAt(state: GameState, now: number): void {
  state.clock.baseMs = gameTimeMs(state.clock, now)
  state.clock.runningSince = null
}

function settle(state: GameState, gameMs: number): void {
  settlePenalties(state.penalties, gameMs, state.rules.maxPenalizedOnIce)
}

/** Passa al periodo `period`, con eventuale pausa prima che sia pronto. */
function goToPeriod(state: GameState, period: number, breakMs: number, at: number): void {
  const start = state.clock.periodEndMs
  state.period = period
  state.clock = {
    baseMs: start,
    runningSince: null,
    periodStartMs: start,
    periodEndMs: start + periodLengthMs(state.rules, period),
  }
  if (breakMs > 0) {
    state.phase = 'intermission'
    state.intermission = { remainingMs: breakMs, runningSince: at }
  } else {
    state.phase = 'ready'
    state.intermission = null
  }
}

function startShootout(state: GameState): void {
  state.phase = 'shootout'
  state.shootout = { home: [], away: [] }
}

/** Fine del periodo: decide se si va all'intervallo, al supplementare, ai rigori o al termine. */
function finishPeriod(state: GameState, at: number): void {
  const { rules } = state
  state.clock.baseMs = state.clock.periodEndMs
  state.clock.runningSince = null
  state.timeout = null
  settle(state, state.clock.periodEndMs)

  if (state.period < rules.periods) {
    goToPeriod(state, state.period + 1, rules.intermissionMs, at)
    return
  }

  const tied = state.teams.home.goals === state.teams.away.goals
  if (!tied) {
    state.phase = 'final'
    return
  }

  const overtimesPlayed = state.period - rules.periods
  const moreOvertime =
    rules.overtime.enabled &&
    (rules.overtime.maxPeriods === 0 || overtimesPlayed < rules.overtime.maxPeriods)

  if (moreOvertime) {
    goToPeriod(state, state.period + 1, rules.overtime.breakMs, at)
  } else if (rules.shootout.enabled) {
    startShootout(state)
  } else {
    state.phase = 'final'
  }
}

/**
 * Porta lo stato all'istante `now`: fine periodo, fine intervallo, fine
 * timeout e scadenza delle penalità. Ogni passaggio avviene nell'istante
 * esatto in cui è dovuto, quindi il risultato non dipende da quanto spesso
 * viene chiamata. Non modifica lo stato ricevuto.
 */
export function advance(state: GameState, now: number): GameState {
  const s = structuredClone(state)

  // Al massimo qualche passaggio per chiamata (es. fine periodo + fine intervallo).
  for (let guard = 0; guard < 10; guard++) {
    if (s.timeout) {
      const end = countdownEndsAt(s.timeout.clock)
      if (end !== null && end <= now) s.timeout = null
    }

    if (s.phase === 'play') {
      const endsAt = periodEndsAt(s.clock)
      const reachedEnd = gameTimeMs(s.clock, now) >= s.clock.periodEndMs
      if (reachedEnd) {
        finishPeriod(s, endsAt ?? now)
        continue
      }
      settle(s, gameTimeMs(s.clock, now))
    }

    if (s.phase === 'intermission' && s.intermission) {
      const end = countdownEndsAt(s.intermission)
      if (end !== null && end <= now) {
        s.phase = 'ready'
        s.intermission = null
        continue
      }
    }
    break
  }
  return s
}

/** Applica un comando all'istante `now`. Non modifica lo stato ricevuto. */
export function apply(state: GameState, command: Command, now: number): GameState {
  const s = advance(state, now)
  const max = s.rules.maxPenalizedOnIce
  const gameMs = gameTimeMs(s.clock, now)
  const elapsed = periodElapsedMs(s.clock, now)

  switch (command.type) {
    case 'startClock': {
      if (s.phase !== 'ready' && s.phase !== 'play') break
      if (isClockRunning(s) || gameMs >= s.clock.periodEndMs) break
      s.phase = 'play'
      s.timeout = null
      s.clock.runningSince = now
      break
    }

    case 'stopClock': {
      if (isClockRunning(s)) stopClockAt(s, now)
      break
    }

    case 'toggleClock':
      return apply(s, { type: isClockRunning(s) ? 'stopClock' : 'startClock' }, now)

    case 'setClock': {
      if (s.phase !== 'ready' && s.phase !== 'play') break
      const length = s.clock.periodEndMs - s.clock.periodStartMs
      const remaining = Math.min(length, Math.max(0, command.remainingMs))
      const newGameMs = s.clock.periodEndMs - remaining
      shiftActivePenalties(s.penalties, newGameMs - gameMs)
      s.clock.baseMs = newGameMs
      if (isClockRunning(s)) s.clock.runningSince = now
      break
    }

    case 'goal': {
      if (s.phase === 'shootout') break
      const inPlay = s.phase === 'play'
      const skaters = skatersOnIce(s.penalties, baseSkaters(s))
      const powerPlay = inPlay && applyPowerPlayGoal(s.penalties, command.team, gameMs, s.rules)
      const shortHanded = inPlay && skaters[command.team] < skaters[opponent(command.team)]

      s.teams[command.team].goals += 1
      s.events.push({
        id: s.nextId++,
        type: 'goal',
        team: command.team,
        player: command.player ?? '',
        period: s.period,
        periodElapsedMs: elapsed,
        powerPlay,
        shortHanded,
      })

      // Gol nel supplementare: vince chi segna.
      if (inPlay && isOvertime(s)) {
        stopClockAt(s, now)
        s.phase = 'final'
      }
      break
    }

    case 'setScore':
      s.teams[command.team].goals = Math.max(0, Math.floor(command.goals))
      break

    case 'shot': {
      const t = s.teams[command.team]
      t.shots = Math.max(0, t.shots + command.delta)
      break
    }

    case 'penalty': {
      if (s.phase === 'shootout' || s.phase === 'final') break
      const id = s.nextId++
      addPenalty(
        s.penalties,
        {
          id,
          team: command.team,
          player: command.player,
          kind: command.kind,
          durationMs: penaltyDurationMs(s.rules, command.kind),
          status: 'queued',
          startMs: null,
          endMs: null,
          endedBy: null,
          period: s.period,
          periodElapsedMs: elapsed,
        },
        gameMs,
        max,
      )
      s.events.push({
        id: s.nextId++,
        type: 'penalty',
        penaltyId: id,
        team: command.team,
        player: command.player,
        kind: command.kind,
        period: s.period,
        periodElapsedMs: elapsed,
      })
      break
    }

    case 'endPenalty':
      endPenalty(s.penalties, command.id, gameMs, 'manual', max)
      break

    case 'removePenalty':
      removePenalty(s.penalties, command.id, gameMs, max)
      s.events = s.events.filter((e) => !(e.type === 'penalty' && e.penaltyId === command.id))
      break

    case 'timeout': {
      if (s.phase !== 'play' || s.timeout) break
      const t = s.teams[command.team]
      if (t.timeoutsUsed >= s.rules.timeoutsPerTeam) break
      if (isClockRunning(s)) stopClockAt(s, now)
      t.timeoutsUsed += 1
      s.timeout = {
        team: command.team,
        clock: { remainingMs: s.rules.timeoutMs, runningSince: now },
      }
      break
    }

    case 'endTimeout':
      s.timeout = null
      break

    case 'endIntermission':
      if (s.phase === 'intermission') {
        s.phase = 'ready'
        s.intermission = null
      }
      break

    case 'endPeriod':
      if (s.phase === 'ready' || s.phase === 'play') {
        s.phase = 'play'
        stopClockAt(s, now)
        s.clock.baseMs = s.clock.periodEndMs
        finishPeriod(s, now)
      }
      break

    case 'shootoutAttempt': {
      if (s.phase !== 'shootout' || !s.shootout) break
      s.shootout[command.team].push(command.scored)
      if (shootoutWinner(s.shootout, s.rules.shootout.rounds)) s.phase = 'final'
      break
    }

    case 'undoShootoutAttempt': {
      if (!s.shootout || s.shootout[command.team].length === 0) break
      s.shootout[command.team].pop()
      if (s.phase === 'final') s.phase = 'shootout'
      break
    }

    case 'endGame':
      if (isClockRunning(s)) stopClockAt(s, now)
      s.timeout = null
      s.intermission = null
      s.phase = 'final'
      break

    case 'setTeam':
      Object.assign(s.teams[command.team], command.setup)
      break

    case 'newGame': {
      const teams = command.teams ?? {
        home: pickSetup(s.teams.home),
        away: pickSetup(s.teams.away),
      }
      return createGame(command.rules ?? s.rules, teams)
    }
  }

  return advance(s, now)
}

function pickSetup({ name, shortName, color }: TeamState): TeamSetup {
  return { name, shortName, color }
}
