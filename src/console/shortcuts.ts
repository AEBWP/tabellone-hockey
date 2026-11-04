/**
 * Scorciatoie da tastiera della console.
 *
 * Pensate per l'operatore che guarda la pista: i tasti più usati sono
 * grandi o facili da ricordare (C = Casa, O = Ospiti).
 */
export type ShortcutAction =
  'toggleClock' | 'goalHome' | 'goalAway' | 'shotHome' | 'shotAway' | 'undo' | 'help'

export interface Shortcut {
  action: ShortcutAction
  /** Tasti come li vede l'operatore. */
  keys: string[]
  description: string
}

export const SHORTCUTS: readonly Shortcut[] = [
  { action: 'toggleClock', keys: ['Spazio'], description: 'Avvia / ferma il tempo' },
  { action: 'goalHome', keys: ['C'], description: 'Gol squadra di casa' },
  { action: 'goalAway', keys: ['O'], description: 'Gol squadra ospite' },
  { action: 'shotHome', keys: ['Maiusc', 'C'], description: 'Tiro in porta casa' },
  { action: 'shotAway', keys: ['Maiusc', 'O'], description: 'Tiro in porta ospiti' },
  { action: 'undo', keys: ['Ctrl', 'Z'], description: 'Annulla l’ultima azione' },
  { action: 'help', keys: ['F1'], description: 'Apri / chiudi la guida' },
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
  // Tenendo premuto un tasto non si devono segnare dieci gol.
  if (e.repeat) return null

  const ctrl = e.ctrlKey || e.metaKey
  if (ctrl && !e.altKey && e.code === 'KeyZ' && !e.shiftKey) return 'undo'
  if (ctrl || e.altKey) return null

  switch (e.code) {
    case 'Space':
      return e.shiftKey ? null : 'toggleClock'
    case 'KeyC':
      return e.shiftKey ? 'shotHome' : 'goalHome'
    case 'KeyO':
      return e.shiftKey ? 'shotAway' : 'goalAway'
  }
  return null
}

/** True se il tasto arriva mentre l'operatore sta scrivendo in un campo. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'color', 'file', 'range', 'submit'].includes(
      target.type,
    )
  }
  return false
}
