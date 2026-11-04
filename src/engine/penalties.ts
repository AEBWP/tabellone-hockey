import type { Rules } from './rules'
import type { Penalty, PenaltyEndReason, PenaltyKind, TeamId } from './types'

/** Penalità che lasciano la squadra in inferiorità numerica. */
export function countsForStrength(kind: PenaltyKind): boolean {
  return kind !== 'misconduct'
}

/** Penalità che terminano in anticipo se l'avversario segna in superiorità. */
export function endsOnPowerPlayGoal(kind: PenaltyKind): boolean {
  return kind === 'minor' || kind === 'double-minor'
}

export function penaltyDurationMs(rules: Rules, kind: PenaltyKind): number {
  switch (kind) {
    case 'minor':
      return rules.penaltyMs.minor
    case 'double-minor':
      return rules.penaltyMs.minor * 2
    case 'major':
      return rules.penaltyMs.major
    case 'misconduct':
      return rules.penaltyMs.misconduct
  }
}

/** Penalità in corso che lasciano la squadra in inferiorità. */
export function activeCounting(penalties: readonly Penalty[], team: TeamId): Penalty[] {
  return penalties.filter(
    (p) => p.team === team && p.status === 'active' && countsForStrength(p.kind),
  )
}

function startPenalty(p: Penalty, atMs: number): void {
  p.status = 'active'
  p.startMs = atMs
  p.endMs = atMs + p.durationMs
}

/** Fa partire le penalità in coda finché c'è posto (max giocatori penalizzati). */
function fillSlots(penalties: Penalty[], team: TeamId, atMs: number, max: number): void {
  for (const p of penalties) {
    if (activeCounting(penalties, team).length >= max) return
    if (p.team === team && p.status === 'queued') startPenalty(p, atMs)
  }
}

/**
 * Porta le penalità al tempo di gioco `gameMs`: chiude quelle scadute e fa
 * partire quelle in coda nell'istante esatto in cui si è liberato il posto.
 * Le scadenze vengono elaborate in ordine cronologico, quindi il risultato
 * non dipende da quanto spesso viene chiamata.
 *
 * Modifica l'array ricevuto.
 */
export function settlePenalties(penalties: Penalty[], gameMs: number, max: number): void {
  for (;;) {
    let earliest: Penalty | null = null
    for (const p of penalties) {
      if (p.status !== 'active' || p.endMs === null || p.endMs > gameMs) continue
      if (earliest === null || p.endMs < earliest.endMs!) earliest = p
    }
    if (earliest === null) return

    earliest.status = 'ended'
    earliest.endedBy ??= 'time'
    if (countsForStrength(earliest.kind)) {
      fillSlots(penalties, earliest.team, earliest.endMs!, max)
    }
  }
}

/** Aggiunge una penalità: parte subito se c'è posto, altrimenti va in coda. */
export function addPenalty(
  penalties: Penalty[],
  penalty: Penalty,
  gameMs: number,
  max: number,
): void {
  penalties.push(penalty)
  if (!countsForStrength(penalty.kind)) {
    startPenalty(penalty, gameMs)
    return
  }
  fillSlots(penalties, penalty.team, gameMs, max)
}

/** Chiude in anticipo una penalità in corso (o in coda) e fa partire la successiva. */
export function endPenalty(
  penalties: Penalty[],
  id: number,
  gameMs: number,
  reason: PenaltyEndReason,
  max: number,
): void {
  const p = penalties.find((x) => x.id === id)
  if (!p || p.status === 'ended') return

  if (p.status === 'queued') {
    p.status = 'ended'
    p.endedBy = reason
    return
  }

  p.endMs = gameMs
  p.endedBy = reason
  settlePenalties(penalties, gameMs, max)
}

/** Elimina una penalità inserita per errore, come se non fosse mai esistita. */
export function removePenalty(penalties: Penalty[], id: number, gameMs: number, max: number): void {
  const index = penalties.findIndex((x) => x.id === id)
  if (index === -1) return
  const [removed] = penalties.splice(index, 1)
  if (removed.status === 'active' && countsForStrength(removed.kind)) {
    fillSlots(penalties, removed.team, gameMs, max)
  }
}

/**
 * Gol in superiorità numerica: termina la penalità minore della squadra
 * penalizzata con meno tempo rimanente. Per una doppia minore termina solo
 * la parte in corso. Le maggiori non terminano.
 *
 * Restituisce true se il gol è stato segnato in superiorità.
 */
export function applyPowerPlayGoal(
  penalties: Penalty[],
  scoringTeam: TeamId,
  gameMs: number,
  rules: Rules,
): boolean {
  const conceding: TeamId = scoringTeam === 'home' ? 'away' : 'home'
  const scorerShort = activeCounting(penalties, scoringTeam).length
  const concedingShort = activeCounting(penalties, conceding)
  if (concedingShort.length <= scorerShort) return false

  const candidates = concedingShort
    .filter((p) => endsOnPowerPlayGoal(p.kind))
    .sort((a, b) => a.endMs! - b.endMs!)
  const target = candidates[0]
  if (!target) return true

  if (target.kind === 'double-minor') {
    const elapsed = gameMs - target.startMs!
    if (elapsed < rules.penaltyMs.minor) {
      // Termina la prima minore: la seconda parte da adesso, intera.
      // Spostiamo anche l'inizio, così un altro gol trova la seconda parte già in corso.
      target.startMs = gameMs - rules.penaltyMs.minor
      target.endMs = gameMs + rules.penaltyMs.minor
      return true
    }
  }

  endPenalty(penalties, target.id, gameMs, 'goal', rules.maxPenalizedOnIce)
  return true
}

/**
 * Sposta nel tempo le penalità in corso di `deltaMs` di gioco: usato quando
 * l'operatore corregge il cronometro, così le penalità non cambiano.
 */
export function shiftActivePenalties(penalties: Penalty[], deltaMs: number): void {
  for (const p of penalties) {
    if (p.status !== 'active') continue
    p.startMs! += deltaMs
    p.endMs! += deltaMs
  }
}

/**
 * Giocatori di movimento in pista per squadra.
 *
 * Con 5 giocatori di base ogni penalità ne toglie uno. Nel supplementare a
 * ranghi ridotti (es. 3 contro 3) è invece l'avversario ad aggiungere
 * giocatori, come da regolamento IIHF.
 */
export function skatersOnIce(
  penalties: readonly Penalty[],
  baseSkaters: number,
): Record<TeamId, number> {
  const homeShort = activeCounting(penalties, 'home').length
  const awayShort = activeCounting(penalties, 'away').length

  if (baseSkaters >= 5) {
    return { home: baseSkaters - homeShort, away: baseSkaters - awayShort }
  }

  const diff = homeShort - awayShort
  return {
    home: baseSkaters + Math.max(0, Math.min(-diff, 2)),
    away: baseSkaters + Math.max(0, Math.min(diff, 2)),
  }
}
