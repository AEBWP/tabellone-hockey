import type { GameState } from './types'

/**
 * Cronologia per "Annulla ultima azione".
 *
 * Si registrano solo le azioni di gioco (gol, penalità, tiri, timeout, rigori),
 * non i comandi del cronometro. Annullando, si torna allo stato precedente
 * per punteggio, penalità ed eventi, ma il cronometro resta com'è adesso:
 * annullare un gol non deve far tornare indietro il tempo.
 *
 * Non si può annullare oltre l'inizio del periodo in corso.
 */
export interface HistoryEntry {
  /** Descrizione per l'operatore, es. "Gol Casa". */
  label: string
  state: GameState
}

export const HISTORY_LIMIT = 50

export function pushHistory(
  history: readonly HistoryEntry[],
  label: string,
  before: GameState,
): HistoryEntry[] {
  return [...history, { label, state: before }].slice(-HISTORY_LIMIT)
}

export function canUndo(history: readonly HistoryEntry[], current: GameState): boolean {
  const last = history.at(-1)
  return !!last && last.state.period === current.period && current.phase !== 'intermission'
}

/** Stato dopo l'annullamento, oppure null se non è possibile annullare. */
export function undo(
  history: readonly HistoryEntry[],
  current: GameState,
): { state: GameState; history: HistoryEntry[]; label: string } | null {
  if (!canUndo(history, current)) return null
  const last = history.at(-1)!
  const previous = structuredClone(last.state)

  // Fasi decise da un risultato (fine partita, rigori) tornano come prima;
  // altrimenti la fase segue il cronometro attuale.
  const phaseFromResult =
    current.phase === 'final' || current.phase === 'shootout' || previous.phase === 'shootout'

  return {
    state: {
      ...previous,
      phase: phaseFromResult ? previous.phase : current.phase,
      clock: structuredClone(current.clock),
      intermission: structuredClone(current.intermission),
      nextId: Math.max(previous.nextId, current.nextId),
      // La lingua del tabellone è un'impostazione: non torna indietro con l'annulla.
      boardLanguage: current.boardLanguage,
      // Nemmeno i lati: annullare un gol non rigira le squadre.
      sidesSwapped: current.sidesSwapped,
    },
    history: history.slice(0, -1),
    label: last.label,
  }
}
