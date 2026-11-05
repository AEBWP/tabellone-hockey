import type { Rules } from './rules'

export type TeamId = 'home' | 'away'

/** Stile grafico del tabellone spettatori. */
export type BoardStyle = 'arena' | 'broadcast' | 'classico'
export const BOARD_STYLES: readonly BoardStyle[] = ['arena', 'broadcast', 'classico']
export const TEAM_IDS: readonly TeamId[] = ['home', 'away']

export function opponent(team: TeamId): TeamId {
  return team === 'home' ? 'away' : 'home'
}

/**
 * Fasi della partita.
 * - `ready`: periodo pronto, tempo pieno e fermo (prima del primo ingaggio).
 * - `play`: periodo in corso; il tempo può essere in moto o fermo.
 * - `intermission`: intervallo prima del periodo `period`.
 * - `shootout`: tiri di rigore.
 * - `final`: partita terminata.
 */
export type Phase = 'ready' | 'play' | 'intermission' | 'shootout' | 'final'

/**
 * Cronometro di gioco basato sul "tempo di gioco assoluto": i millisecondi
 * giocati dall'inizio della partita. Il tempo non viene mai decrementato a
 * passi, ma calcolato da timestamp: nessun ritardo accumulato.
 */
export interface GameClock {
  /** Tempo di gioco assoluto al momento dell'ultimo avvio/arresto. */
  baseMs: number
  /** Timestamp (ms) dell'ultimo avvio, oppure null se fermo. */
  runningSince: number | null
  /** Tempo di gioco assoluto a inizio periodo. */
  periodStartMs: number
  /** Tempo di gioco assoluto a fine periodo. */
  periodEndMs: number
}

/** Conto alla rovescia semplice (intervallo, timeout). */
export interface Countdown {
  remainingMs: number
  runningSince: number | null
}

export type PenaltyKind = 'minor' | 'double-minor' | 'major' | 'misconduct'

export type PenaltyStatus = 'queued' | 'active' | 'ended'
export type PenaltyEndReason = 'time' | 'goal' | 'manual'

export interface Penalty {
  id: number
  team: TeamId
  /** Numero di maglia (o "PANCHINA"); testo libero. */
  player: string
  kind: PenaltyKind
  durationMs: number
  status: PenaltyStatus
  /** Tempo di gioco assoluto di inizio, se partita. */
  startMs: number | null
  /** Tempo di gioco assoluto di fine, se partita. */
  endMs: number | null
  endedBy: PenaltyEndReason | null
  /** Quando è stata inflitta. */
  period: number
  periodElapsedMs: number
}

export interface TeamState extends TeamSetup {
  goals: number
  shots: number
  timeoutsUsed: number
}

export interface GoalEvent {
  id: number
  type: 'goal'
  team: TeamId
  player: string
  period: number
  periodElapsedMs: number
  /** Gol in superiorità numerica. */
  powerPlay: boolean
  /** Gol in inferiorità numerica. */
  shortHanded: boolean
}

export interface PenaltyEvent {
  id: number
  type: 'penalty'
  penaltyId: number
  team: TeamId
  player: string
  kind: PenaltyKind
  period: number
  periodElapsedMs: number
}

export type GameEvent = GoalEvent | PenaltyEvent

export interface Timeout {
  team: TeamId
  clock: Countdown
}

export interface ShootoutState {
  /** Esito di ogni tiro, in ordine: true = gol. */
  home: boolean[]
  away: boolean[]
}

export interface GameState {
  rules: Rules
  teams: Record<TeamId, TeamState>
  phase: Phase
  /** Periodo corrente (1-based); oltre `rules.periods` sono supplementari. Durante l'intervallo è il periodo che sta per iniziare. */
  period: number
  clock: GameClock
  intermission: Countdown | null
  timeout: Timeout | null
  penalties: Penalty[]
  events: GameEvent[]
  shootout: ShootoutState | null
  /**
   * Mostrare i loghi sul tabellone? Anche se true, una squadra senza logo
   * resta senza. Torna true a ogni nuova partita.
   */
  showLogos: boolean
  /** Stile del tabellone: è un'impostazione, resta uguale nelle nuove partite. */
  boardStyle: BoardStyle
  nextId: number
}

export interface TeamSetup {
  name: string
  /** Sigla breve (es. "HCB"). */
  shortName: string
  color: string
  /**
   * Logo della squadra come immagine incorporata (data URL), già
   * ridimensionata al caricamento; null = nessun logo.
   */
  logo: string | null
}
