import { countdownEndsAt, gameTimeMs, periodElapsedMs, periodEndsAt } from './clock'
import {
  addPenalty,
  applyPowerPlayGoal,
  endPenalty,
  penaltyChanges,
  penaltyDurationMs,
  removePenalty,
  revertPenaltyChanges,
  settlePenalties,
  shiftActivePenalties,
  skatersOnIce,
  snapshotPenalties,
} from './penalties'
import { DEFAULT_RULES, periodLengthMs, type Rules } from './rules'
import { shootoutWinner } from './shootout'
import {
  BOARD_STYLES,
  LANGUAGES,
  opponent,
  type BoardStyle,
  type GameState,
  type Language,
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
  /**
   * Gol segnato: solo a gioco in corso (fase `play`, anche a tempo fermo). Negli
   * intervalli, prima del via di un periodo e a fine partita si usano le correzioni.
   */
  | { type: 'goal'; team: TeamId; player?: string }
  /**
   * Correzione manuale del punteggio: nessun effetto su penalità e animazioni. Se
   * il punteggio scende sotto i gol della cronaca, gli ultimi gol di quella
   * squadra spariscono dalla cronaca (es. GOL premuto per sbaglio).
   */
  | { type: 'setScore'; team: TeamId; goals: number }
  | { type: 'shot'; team: TeamId; delta: number }
  | { type: 'penalty'; team: TeamId; player: string; kind: PenaltyKind }
  /** Chiude in anticipo una penalità. */
  | { type: 'endPenalty'; id: number }
  /** Elimina una penalità inserita per errore. */
  | { type: 'removePenalty'; id: number }
  | { type: 'timeout'; team: TeamId }
  /**
   * Restituisce un timeout chiamato per sbaglio: se è ancora in corso si chiude
   * (il tempo resta fermo).
   */
  | { type: 'restoreTimeout'; team: TeamId }
  | { type: 'endTimeout' }
  /** Termina subito l'intervallo: il periodo successivo è pronto. */
  | { type: 'endIntermission' }
  /** Termina subito il periodo in corso. */
  | { type: 'endPeriod' }
  | { type: 'shootoutAttempt'; team: TeamId; scored: boolean }
  | { type: 'undoShootoutAttempt'; team: TeamId }
  | { type: 'endGame' }
  | { type: 'setTeam'; team: TeamId; setup: Partial<TeamSetup> }
  /** Mostra o nasconde i loghi di tutte e due le squadre sul tabellone. */
  | { type: 'setShowLogos'; show: boolean }
  /** Scambia i lati delle squadre (casa a destra o a sinistra): punti e penalità restano a ognuna. */
  | { type: 'swapSides' }
  /** Cambia lo stile grafico del tabellone. */
  | { type: 'setBoardStyle'; style: BoardStyle }
  /** Cambia la lingua delle scritte del tabellone. */
  | { type: 'setBoardLanguage'; language: Language }
  /**
   * Cambia le regole della partita in corso. Valgono dal prossimo periodo;
   * se il periodo attuale non è ancora iniziato, anche la sua durata si adegua.
   */
  | { type: 'setRules'; rules: Rules }
  | { type: 'newGame'; rules?: Rules; teams?: Partial<Record<TeamId, TeamSetup>> }

export const DEFAULT_TEAMS: Record<TeamId, TeamSetup> = {
  home: { name: 'Casa', shortName: 'CASA', color: '#d62839', logo: null },
  away: { name: 'Ospiti', shortName: 'OSP', color: '#1f6feb', logo: null },
}

function team(setup: TeamSetup): TeamState {
  return { ...setup, goals: 0, shots: 0, timeoutsUsed: 0 }
}

export function createGame(
  rules: Rules = DEFAULT_RULES,
  teams: Partial<Record<TeamId, TeamSetup>> = {},
  boardStyle: BoardStyle = 'arena',
  boardLanguage: Language = 'it',
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
    showLogos: true,
    sidesSwapped: false,
    boardStyle,
    boardLanguage,
    nextId: 1,
  }
}

export function isOvertime(state: GameState): boolean {
  return state.period > state.rules.periods
}

export function isClockRunning(state: GameState): boolean {
  return state.clock.runningSince !== null
}

/**
 * Partita non ancora iniziata: il tempo non è mai partito e non è successo
 * niente. Il tabellone mostra la presentazione “A VS B”.
 */
export function isPregame(s: GameState): boolean {
  return (
    s.phase === 'ready' &&
    s.period === 1 &&
    s.clock.baseMs === 0 &&
    s.clock.runningSince === null &&
    s.events.length === 0 &&
    s.teams.home.goals === 0 &&
    s.teams.away.goals === 0
  )
}

/**
 * Comandi di gioco che non hanno senso prima dell'inizio (gol, tiri,
 * penalità, timeout, correzioni del tempo, fine periodo/partita): finché il
 * tempo non parte vengono ignorati. Restano liberi l'avvio del tempo,
 * squadre, regolamento, stile e nuova partita.
 */
const BLOCKED_BEFORE_START = new Set<Command['type']>([
  'setClock',
  'goal',
  'setScore',
  'shot',
  'penalty',
  'endPenalty',
  'removePenalty',
  'timeout',
  'endTimeout',
  'endPeriod',
  'shootoutAttempt',
  'undoShootoutAttempt',
  'endGame',
])

/** Con il regolamento "solo cronometro" non esistono punti, tiri, penalità e timeout. */
const BLOCKED_CLOCK_ONLY = new Set<Command['type']>([
  'goal',
  'setScore',
  'shot',
  'penalty',
  'endPenalty',
  'removePenalty',
  'timeout',
  'restoreTimeout',
  'endTimeout',
  'shootoutAttempt',
  'undoShootoutAttempt',
])

/** Il comando è permesso adesso? (La console lo usa anche per disattivare i pulsanti.) */
export function isAllowed(s: GameState, type: Command['type']): boolean {
  if (s.rules.clockOnly === true && BLOCKED_CLOCK_ONLY.has(type)) return false
  return !(BLOCKED_BEFORE_START.has(type) && isPregame(s))
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

  if (rules.clockOnly === true) {
    state.phase = 'final'
    return
  }

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
 * viene chiamata. Non modifica lo stato ricevuto: se non c'è nulla da fare
 * restituisce lo stesso oggetto (da non modificare).
 */
export function advance(state: GameState, now: number): GameState {
  // Quasi sempre (a ogni fotogramma) non c'è nulla da fare: si evita di
  // copiare lo stato, che con i loghi pesa centinaia di kB.
  if (!hasPendingTransition(state, now)) return state
  return advanceInPlace(structuredClone(state), now)
}

/**
 * C'è un passaggio dovuto entro `now`? (fine timeout, fine periodo, penalità
 * scaduta, fine intervallo). Deve coprire tutti i casi di `advanceInPlace`.
 */
function hasPendingTransition(s: GameState, now: number): boolean {
  if (s.timeout) {
    const end = countdownEndsAt(s.timeout.clock)
    if (end !== null && end <= now) return true
  }
  if (s.phase === 'play') {
    const gameMs = gameTimeMs(s.clock, now)
    if (gameMs >= s.clock.periodEndMs) return true
    for (const p of s.penalties) {
      if (p.status === 'active' && p.endMs !== null && p.endMs <= gameMs) return true
    }
  }
  if (s.phase === 'intermission' && s.intermission) {
    const end = countdownEndsAt(s.intermission)
    if (end !== null && end <= now) return true
  }
  return false
}

/** Come `advance`, ma modifica lo stato ricevuto. */
function advanceInPlace(s: GameState, now: number): GameState {
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
  const s = advanceInPlace(structuredClone(state), now)
  if (!isAllowed(s, command.type)) return s
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
      // Tempo corretto a zero prima del via: il periodo è finito (senza questo il
      // tempo resterebbe bloccato a 0.0, con "Avvia" disattivato).
      if (remaining === 0) s.phase = 'play'
      break
    }

    case 'goal': {
      // Solo a gioco in corso: un gol arrivato dopo la sirena non finisce nel
      // periodo successivo (si corregge il punteggio con +1).
      if (s.phase !== 'play') break
      const skaters = skatersOnIce(s.penalties, baseSkaters(s))
      const beforeGoal = snapshotPenalties(s.penalties)
      const powerPlay = applyPowerPlayGoal(s.penalties, command.team, gameMs, s.rules)
      const shortHanded = skaters[command.team] < skaters[opponent(command.team)]
      const changes = penaltyChanges(beforeGoal, s.penalties)

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
        ...(changes.length > 0 ? { penaltyChanges: changes } : {}),
      })

      // Gol nel supplementare: vince chi segna.
      if (isOvertime(s)) {
        stopClockAt(s, now)
        s.phase = 'final'
      }
      break
    }

    case 'setScore': {
      const goals = Math.max(0, Math.floor(command.goals))
      s.teams[command.team].goals = goals
      // Gol tolti con la correzione (gol annullato): spariscono anche dalla
      // cronaca, gli ultimi di quella squadra.
      let extra =
        s.events.filter((e) => e.type === 'goal' && e.team === command.team).length - goals
      let restored = false
      for (let i = s.events.length - 1; i >= 0 && extra > 0; i--) {
        const e = s.events[i]
        if (e.type !== 'goal' || e.team !== command.team) continue
        s.events.splice(i, 1)
        extra--
        // Gol in superiorità annullato: per regolamento la penalità che aveva
        // chiuso continua con il tempo che mancava.
        if (e.penaltyChanges && revertPenaltyChanges(s.penalties, e.penaltyChanges).length > 0) {
          restored = true
        }
      }
      if (restored) settle(s, gameMs)
      reconcileResult(s)
      break
    }

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

    case 'restoreTimeout': {
      const t = s.teams[command.team]
      if (t.timeoutsUsed === 0) break
      t.timeoutsUsed -= 1
      if (s.timeout?.team === command.team) s.timeout = null
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

    case 'setBoardStyle':
      if (BOARD_STYLES.includes(command.style)) s.boardStyle = command.style
      break

    case 'setBoardLanguage':
      if (LANGUAGES.includes(command.language)) s.boardLanguage = command.language
      break

    case 'swapSides':
      s.sidesSwapped = !s.sidesSwapped
      break

    case 'setShowLogos':
      s.showLogos = command.show
      break

    case 'setTeam':
      Object.assign(s.teams[command.team], command.setup)
      break

    case 'setRules': {
      s.rules = structuredClone(command.rules)
      const notStarted =
        s.phase !== 'final' &&
        s.phase !== 'shootout' &&
        !isClockRunning(s) &&
        s.clock.baseMs === s.clock.periodStartMs
      if (notStarted) {
        s.clock.periodEndMs = s.clock.periodStartMs + periodLengthMs(s.rules, s.period)
      }
      break
    }

    case 'newGame': {
      const teams = command.teams ?? {
        home: pickSetup(s.teams.home),
        away: pickSetup(s.teams.away),
      }
      return createGame(command.rules ?? s.rules, teams, s.boardStyle, s.boardLanguage)
    }
  }

  return advanceInPlace(s, now)
}

/**
 * Dopo una correzione del punteggio, il risultato decide di nuovo come per
 * regolamento (es. gol annullato dopo la verifica video, o gol sulla sirena
 * convalidato):
 * - partita finita (non ai rigori) che ora è in parità: si riapre. Ferma a fine
 *   periodo si decide di nuovo (supplementare, rigori o pareggio); altrimenti,
 *   come dopo un gol del supplementare annullato, si riprende a giocare;
 * - supplementare o rigori non ancora iniziati con un risultato che ora non è
 *   più in parità: la partita è finita al periodo precedente.
 */
function reconcileResult(s: GameState): void {
  const tied = s.teams.home.goals === s.teams.away.goals
  if (tied && s.phase === 'final' && !s.shootout) {
    s.phase = 'play'
    return
  }
  if (tied) return

  if (s.phase === 'shootout' && s.shootout?.home.length === 0 && s.shootout.away.length === 0) {
    s.shootout = null
    s.phase = 'final'
    return
  }

  const overtimeNotStarted =
    (s.phase === 'ready' || s.phase === 'intermission') &&
    isOvertime(s) &&
    s.clock.baseMs === s.clock.periodStartMs
  if (overtimeNotStarted) {
    // Si torna all'ultimo periodo giocato, finito: tabellone e lati come a fine partita.
    const end = s.clock.periodStartMs
    s.period -= 1
    s.clock = {
      baseMs: end,
      runningSince: null,
      periodStartMs: end - periodLengthMs(s.rules, s.period),
      periodEndMs: end,
    }
    s.intermission = null
    s.timeout = null
    s.phase = 'final'
  }
}

function pickSetup({ name, shortName, color, logo }: TeamState): TeamSetup {
  return { name, shortName, color, logo }
}
