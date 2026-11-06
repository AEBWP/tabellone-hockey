import type { GameState } from '../engine'

/** Messaggi scambiati tra console operatore e tabellone spettatori. */
export type Message =
  /** Il tabellone si è appena aperto e chiede lo stato attuale. */
  | { type: 'hello' }
  /** La console segnala di essere attiva (inviato a intervalli regolari). */
  | { type: 'heartbeat'; sentAt: number }
  /**
   * Stato completo della partita. Viene inviato solo quando cambia: il
   * tabellone calcola da sé il tempo che scorre a partire dai timestamp.
   */
  | { type: 'state'; state: GameState }
  /** Il tabellone segnala di essere aperto (la console mostra se è collegato). */
  | { type: 'displayHeartbeat' }
  /** Versione browser: la console chiede al tabellone di chiudersi (o di spegnersi). */
  | { type: 'closeDisplay' }

export const HEARTBEAT_INTERVAL_MS = 1_000
/** Oltre questo intervallo senza heartbeat, l'altra finestra è considerata scollegata. */
export const HEARTBEAT_TIMEOUT_MS = 3_500
