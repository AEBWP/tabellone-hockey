import { describe, expect, it } from 'vitest'
import { actionForKey, type KeyInput } from './shortcuts'

function key(code: string, extra: Partial<KeyInput> = {}): KeyInput {
  return {
    key: code.replace('Key', '').toLowerCase(),
    code,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...extra,
  }
}

describe('scorciatoie', () => {
  it('spazio avvia e ferma il tempo', () => {
    expect(actionForKey(key('Space'))).toBe('toggleClock')
  })

  it('C e O segnano i gol, con Maiusc i tiri', () => {
    expect(actionForKey(key('KeyC'))).toBe('goalHome')
    expect(actionForKey(key('KeyO'))).toBe('goalAway')
    expect(actionForKey(key('KeyC', { shiftKey: true }))).toBe('shotHome')
    expect(actionForKey(key('KeyO', { shiftKey: true }))).toBe('shotAway')
  })

  it('M attiva e disattiva l’audio', () => {
    expect(actionForKey(key('KeyM'))).toBe('mute')
  })

  it('Ctrl+Z annulla, F1 apre la guida', () => {
    expect(actionForKey(key('KeyZ', { ctrlKey: true }))).toBe('undo')
    expect(actionForKey({ ...key('F1'), key: 'F1' })).toBe('help')
    expect(actionForKey({ ...key('F11'), key: 'F11' })).toBe('fullscreen')
  })

  it('ignora la ripetizione automatica e le combinazioni con Ctrl/Alt', () => {
    expect(actionForKey(key('KeyC', { repeat: true }))).toBeNull()
    expect(actionForKey(key('KeyC', { ctrlKey: true }))).toBeNull()
    expect(actionForKey(key('KeyO', { altKey: true }))).toBeNull()
    expect(actionForKey(key('KeyX'))).toBeNull()
  })
})
