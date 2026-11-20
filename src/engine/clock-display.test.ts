import { describe, expect, it } from 'vitest'
import { apply, createGame, deriveView, type GameState } from '.'
import { formatElapsed } from './clock'
import { DEFAULT_RULES, type Rules } from './rules'

const T0 = 1_000_000
const MIN = 60_000

const rules = (patch: Partial<Rules> = {}): Rules => ({
  ...structuredClone(DEFAULT_RULES),
  ...patch,
})

describe('formatElapsed', () => {
  it('parte da 0:00 e conta solo i secondi compiuti', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(999)).toBe('0:00')
    expect(formatElapsed(1_000)).toBe('0:01')
    expect(formatElapsed(65_400)).toBe('1:05')
    expect(formatElapsed(20 * MIN)).toBe('20:00')
    expect(formatElapsed(-5)).toBe('0:00')
  })
})

describe('tempo in progressivo', () => {
  it('per default il tempo è un conto alla rovescia', () => {
    const view = deriveView(createGame(), T0)
    expect(view.clockCountsUp).toBe(false)
    expect(view.clockText).toBe('20:00')
  })

  it('con la regola il tabellone mostra il tempo trascorso, da 0:00 a fine periodo', () => {
    let s = createGame(rules({ clockCountsUp: true }))
    expect(deriveView(s, T0).clockText).toBe('0:00')
    s = apply(s, { type: 'startClock' }, T0)
    expect(deriveView(s, T0 + 90_000).clockText).toBe('1:30')
    expect(deriveView(s, T0 + 20 * MIN - 1).clockText).toBe('19:59')
  })

  it('cambia solo la lettura: il tempo rimanente e la fine del periodo sono gli stessi', () => {
    const up = apply(createGame(rules({ clockCountsUp: true })), { type: 'startClock' }, T0)
    const down = apply(createGame(rules()), { type: 'startClock' }, T0)
    const at = T0 + 7 * MIN
    expect(deriveView(up, at).clockMs).toBe(deriveView(down, at).clockMs)
    // A 20:00 trascorsi il periodo finisce, come a zero nel conto alla rovescia.
    expect(deriveView(up, T0 + 20 * MIN).phase).toBe('intermission')
    expect(deriveView(down, T0 + 20 * MIN).phase).toBe('intermission')
  })

  it('l’ultimo minuto resta evidenziato anche in progressivo', () => {
    const s = apply(createGame(rules({ clockCountsUp: true })), { type: 'startClock' }, T0)
    expect(deriveView(s, T0 + 18 * MIN).clockUrgent).toBe(false)
    const last = deriveView(s, T0 + 19 * MIN + 10_000)
    expect(last.clockUrgent).toBe(true)
    expect(last.clockText).toBe('19:10')
  })

  it('senza decimi nell’ultimo minuto non c’è evidenza', () => {
    const s = apply(createGame(rules({ tenthsBelowMs: 0 })), { type: 'startClock' }, T0)
    expect(deriveView(s, T0 + 19 * MIN + 30_000).clockUrgent).toBe(false)
  })

  it('la correzione del tempo vale anche in progressivo: si imposta quello che rimane', () => {
    let s = createGame(rules({ clockCountsUp: true }))
    s = apply(s, { type: 'startClock' }, T0)
    s = apply(s, { type: 'setClock', remainingMs: 5 * MIN }, T0 + 1_000)
    // Rimangono 5′ (a meno del secondo trascorso): trascorsi circa 15′.
    expect(deriveView(s, T0 + 1_000).clockText).toBe('15:00')
  })
})

describe('tempo totale di gioco', () => {
  const play = (s: GameState, from: number, ms: number) => {
    const started = apply(s, { type: 'startClock' }, from)
    return apply(started, { type: 'stopClock' }, from + ms)
  }

  it('è zero a inizio partita', () => {
    const view = deriveView(createGame(), T0)
    expect(view.playedMs).toBe(0)
    expect(view.playedText).toBe('0:00')
  })

  it('avanza solo a tempo in moto', () => {
    let s = apply(createGame(), { type: 'startClock' }, T0)
    expect(deriveView(s, T0 + 30_000).playedText).toBe('0:30')
    s = apply(s, { type: 'stopClock' }, T0 + 30_000)
    // Tempo fermo: il totale resta dov’è.
    expect(deriveView(s, T0 + 10 * MIN).playedText).toBe('0:30')
    s = apply(s, { type: 'startClock' }, T0 + 10 * MIN)
    expect(deriveView(s, T0 + 10 * MIN + 15_000).playedText).toBe('0:45')
  })

  it('non si azzera al cambio di periodo e passa dall’intervallo senza contarlo', () => {
    let s = play(createGame(), T0, 5 * MIN)
    s = apply(s, { type: 'endPeriod' }, T0 + 5 * MIN)
    const interval = deriveView(s, T0 + 5 * MIN + 3 * MIN)
    expect(interval.phase).toBe('intermission')
    // Periodo chiuso a mano: vale come giocato per intero.
    expect(interval.playedText).toBe('20:00')

    s = apply(s, { type: 'endIntermission' }, T0 + 30 * MIN)
    s = apply(s, { type: 'startClock' }, T0 + 30 * MIN)
    const second = deriveView(s, T0 + 30 * MIN + 2 * MIN)
    expect(second.period).toBe(2)
    expect(second.clockText).toBe('18:00')
    expect(second.playedText).toBe('22:00')
  })

  it('Correggi tempo corregge anche il totale, nel primo periodo e nei successivi', () => {
    let s = play(createGame(), T0, 8 * MIN)
    expect(deriveView(s, T0 + 8 * MIN).playedText).toBe('8:00')
    // Il tempo giusto è 10′ trascorsi, cioè ne rimangono 10′.
    s = apply(s, { type: 'setClock', remainingMs: 10 * MIN }, T0 + 8 * MIN)
    expect(deriveView(s, T0 + 8 * MIN).playedText).toBe('10:00')
    // Correzione all’indietro: il totale cala.
    s = apply(s, { type: 'setClock', remainingMs: 15 * MIN }, T0 + 8 * MIN)
    expect(deriveView(s, T0 + 8 * MIN).playedText).toBe('5:00')

    // Secondo periodo: la correzione agisce sul periodo, il totale tiene i 20′ del primo.
    s = apply(s, { type: 'endPeriod' }, T0 + 9 * MIN)
    s = apply(s, { type: 'endIntermission' }, T0 + 9 * MIN)
    s = play(s, T0 + 30 * MIN, 4 * MIN)
    expect(deriveView(s, T0 + 34 * MIN).playedText).toBe('24:00')
    s = apply(s, { type: 'setClock', remainingMs: 12 * MIN }, T0 + 34 * MIN)
    expect(deriveView(s, T0 + 34 * MIN).playedText).toBe('28:00')
  })

  it('a partita finita resta il tempo giocato', () => {
    let s = createGame(rules({ periods: 1, periodMs: 10 * MIN }))
    s = apply(s, { type: 'startClock' }, T0)
    s = apply(s, { type: 'goal', team: 'home' }, T0 + MIN)
    const end = deriveView(s, T0 + 10 * MIN)
    expect(end.phase).toBe('final')
    expect(end.playedText).toBe('10:00')
  })

  it('è lo stesso con il tempo in progressivo', () => {
    const s = apply(createGame(rules({ clockCountsUp: true })), { type: 'startClock' }, T0)
    const view = deriveView(s, T0 + 2 * MIN)
    expect(view.clockText).toBe('2:00')
    expect(view.playedText).toBe('2:00')
  })
})
