/** Richiesta di conferma per le azioni che non si possono annullare facilmente. */
export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel: string
  /** Pulsante rosso per le azioni distruttive. */
  danger?: boolean
  action: () => void
}
