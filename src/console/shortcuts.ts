/**
 * Scorciatoie da tastiera della console.
 *
 * Pensate per l'operatore che guarda la pista: i tasti più usati sono
 * grandi o facili da ricordare. I gol si segnano con le frecce: ← per la
 * squadra a sinistra, → per quella a destra, come le vede l'operatore in
 * console (con "Inverti squadre" si scambiano anche i tasti).
 */
export type ShortcutAction =
  | 'toggleClock'
  | 'goalLeft'
  | 'goalRight'
  | 'shotLeft'
  | 'shotRight'
  | 'undo'
  | 'mute'
  | 'help'
  | 'fullscreen'

export interface Shortcut {
  action: ShortcutAction
  /** Tasti come li vede l'operatore. */
  keys: string[]
  description: string
}

export const SHORTCUTS: readonly Shortcut[] = [
  { action: 'toggleClock', keys: ['Spazio'], description: 'Avvia / ferma il tempo' },
  { action: 'goalLeft', keys: ['←'], description: 'Gol della squadra a sinistra' },
  { action: 'goalRight', keys: ['→'], description: 'Gol della squadra a destra' },
  { action: 'shotLeft', keys: ['Maiusc', '←'], description: 'Tiro in porta squadra a sinistra' },
  { action: 'shotRight', keys: ['Maiusc', '→'], description: 'Tiro in porta squadra a destra' },
  { action: 'undo', keys: ['Ctrl', 'Z'], description: 'Annulla l’ultima azione' },
  { action: 'mute', keys: ['M'], description: 'Audio sì / no' },
  { action: 'help', keys: ['F1'], description: 'Apri / chiudi la guida' },
  { action: 'fullscreen', keys: ['F11'], description: 'Console a schermo intero sì / no' },
]

export interface KeyInput {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  repeat?: boolean
}

/** Azione associata a un tasto premuto, oppure null. */
export function actionForKey(e: KeyInput): ShortcutAction | null {
  if (e.key === 'F1') return 'help'
  if (e.key === 'F11') return 'fullscreen'
  // Tenendo premuto un tasto non si devono segnare dieci gol.
  if (e.repeat) return null

  const ctrl = e.ctrlKey || e.metaKey
  if (ctrl && !e.altKey && e.code === 'KeyZ' && !e.shiftKey) return 'undo'
  if (ctrl || e.altKey) return null

  switch (e.code) {
    case 'Space':
      return e.shiftKey ? null : 'toggleClock'
    case 'ArrowLeft':
      return e.shiftKey ? 'shotLeft' : 'goalLeft'
    case 'ArrowRight':
      return e.shiftKey ? 'shotRight' : 'goalRight'
    case 'KeyM':
      return e.shiftKey ? null : 'mute'
  }
  return null
}

/** True se il tasto arriva mentre l'operatore sta scrivendo in un campo. */
export function isTypingTarget(target: EventTarget | null, key = ''): boolean {
  if (!(target instanceof HTMLElement)) return false
  // Le frecce su un cursore o su una scelta tra opzioni servono a quelli.
  if (key.startsWith('Arrow') && target instanceof HTMLInputElement) {
    if (target.type === 'range' || target.type === 'radio') return true
  }
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'color', 'file', 'range', 'submit'].includes(
      target.type,
    )
  }
  return false
}
