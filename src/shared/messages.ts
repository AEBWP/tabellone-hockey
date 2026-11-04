/** Messaggi scambiati tra console operatore e tabellone spettatori. */
export type Message =
  /** Il tabellone si è appena aperto e chiede lo stato attuale. */
  | { type: 'hello' }
  /** La console segnala di essere attiva (inviato a intervalli regolari). */
  | { type: 'heartbeat'; sentAt: number }

export const HEARTBEAT_INTERVAL_MS = 1_000
/** Oltre questo intervallo senza heartbeat, il tabellone considera la console scollegata. */
export const HEARTBEAT_TIMEOUT_MS = 3_500
