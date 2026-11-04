import type { Message } from './messages'

/**
 * Canale di comunicazione tra le finestre.
 *
 * Nel browser usa `BroadcastChannel` (funziona tra schede dello stesso
 * browser, anche offline). In Electron verrà affiancata un'implementazione
 * via IPC con la stessa interfaccia, così console e tabellone non cambiano.
 */
export interface Channel {
  send(message: Message): void
  /** Registra un ascoltatore; restituisce la funzione per rimuoverlo. */
  subscribe(listener: (message: Message) => void): () => void
  close(): void
}

const CHANNEL_NAME = 'tabellone-hockey'

export function createChannel(): Channel {
  const bc = new BroadcastChannel(CHANNEL_NAME)
  const listeners = new Set<(message: Message) => void>()

  bc.onmessage = (event: MessageEvent<Message>) => {
    for (const listener of listeners) listener(event.data)
  }

  return {
    send: (message) => bc.postMessage(message),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close() {
      listeners.clear()
      bc.close()
    },
  }
}
