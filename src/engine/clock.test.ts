import { describe, expect, it } from 'vitest'
import { formatClock } from './clock'

describe('formatClock', () => {
  it('mostra minuti e secondi sopra la soglia dei decimi', () => {
    expect(formatClock(20 * 60_000)).toBe('20:00')
    expect(formatClock(5 * 60_000 + 7_000)).toBe('5:07')
    expect(formatClock(60_000)).toBe('1:00')
  })

  it('arrotonda i secondi per eccesso', () => {
    expect(formatClock(20 * 60_000 - 800)).toBe('20:00')
    expect(formatClock(61_001)).toBe('1:02')
  })

  it('mostra i decimi sotto la soglia', () => {
    expect(formatClock(59_999)).toBe('59.9')
    expect(formatClock(9_340)).toBe('9.3')
    expect(formatClock(99)).toBe('0.0')
  })

  it('non mostra i decimi se la soglia è zero', () => {
    expect(formatClock(59_999, 0)).toBe('1:00')
    expect(formatClock(400, 0)).toBe('0:01')
  })

  it('non scende mai sotto zero', () => {
    expect(formatClock(-500)).toBe('0.0')
    expect(formatClock(-500, 0)).toBe('0:00')
  })
})
