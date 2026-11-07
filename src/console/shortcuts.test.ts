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

  it('le frecce segnano i gol della squadra a sinistra o a destra, con Maiusc i tiri', () => {
    expect(actionForKey(key('ArrowLeft'))).toBe('goalLeft')
    expect(actionForKey(key('ArrowRight'))).toBe('goalRight')
    expect(actionForKey(key('ArrowLeft', { shiftKey: true }))).toBe('shotLeft')
    expect(actionForKey(key('ArrowRight', { shiftKey: true }))).toBe('shotRight')
    // C e O non segnano più.
    expect(actionForKey(key('KeyC'))).toBeNull()
    expect(actionForKey(key('KeyO'))).toBeNull()
  })

  it('M attiva e disattiva l’audio', () => {
    expect(actionForKey(key('KeyM'))).toBe('mute')
  })

  it('F1 apre la guida, Ctrl+Z non fa nulla (niente "Annulla")', () => {
    expect(actionForKey(key('KeyZ', { ctrlKey: true }))).toBeNull()
    expect(actionForKey({ ...key('F1'), key: 'F1' })).toBe('help')
    expect(actionForKey({ ...key('F11'), key: 'F11' })).toBe('fullscreen')
  })

  it('ignora la ripetizione automatica e le combinazioni con Ctrl/Alt', () => {
    expect(actionForKey(key('ArrowLeft', { repeat: true }))).toBeNull()
    expect(actionForKey(key('ArrowLeft', { ctrlKey: true }))).toBeNull()
    expect(actionForKey(key('ArrowRight', { altKey: true }))).toBeNull()
    expect(actionForKey(key('KeyX'))).toBeNull()
  })
})
