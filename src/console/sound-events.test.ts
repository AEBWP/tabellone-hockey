import { describe, expect, it } from 'vitest'
import { apply, createGame, deriveView, type Command, type GameState } from '../engine'
import { snapshot, soundEvents, type SoundId } from './sound-events'

const SEC = 1_000
const MIN = 60 * SEC

/** Simula la console: applica comandi, lascia scorrere il tempo e raccoglie i suoni. */
function session() {
  let state: GameState = createGame()
  let now = 1_000_000
  let prev = snapshot(state, deriveView(state, now))
  const heard: SoundId[] = []

  const check = () => {
    const cur = snapshot(state, deriveView(state, now))
    heard.push(...soundEvents(prev, cur))
    prev = cur
  }

  return {
    heard,
    do(...commands: Command[]) {
      for (const c of commands) {
        state = apply(state, c, now)
        check()
      }
      return this
    },
    /** Avanza a piccoli passi, come il controllo periodico della console. */
    wait(ms: number, step = 100) {
      for (let t = 0; t < ms; t += step) {
        now += step
        check()
      }
      return this
    },
    set(next: GameState) {
      state = next
      check()
    },
    get state() {
      return state
    },
  }
}

describe('quando suonare', () => {
  it('sirena del gol solo con il pulsante GOL', () => {
    const s = session().do({ type: 'startClock' }, { type: 'goal', team: 'home' })
    s.do({ type: 'setScore', team: 'away', goals: 3 })
    expect(s.heard).toEqual(['goal'])
  })

  it('sirena a fine periodo, poi segnale a fine intervallo', () => {
    const s = session().do({ type: 'setClock', remainingMs: 2 * SEC }, { type: 'startClock' })
    s.wait(3 * SEC)
    expect(s.heard).toEqual(['periodEnd'])
    s.wait(15 * MIN)
    expect(s.heard).toEqual(['periodEnd', 'intermissionEnd'])
  })

  it('anche terminando il periodo a mano', () => {
    const s = session().do({ type: 'startClock' }, { type: 'endPeriod' })
    expect(s.heard).toEqual(['periodEnd'])
  })

  it('il gol decisivo del supplementare suona una volta sola', () => {
    const s = session().do(
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'endPeriod' },
    )
    s.heard.length = 0
    s.do({ type: 'startClock' }, { type: 'goal', team: 'home' })
    expect(s.heard).toEqual(['goal'])
  })

  it('timeout: segnale all’inizio e alla fine naturale', () => {
    const s = session().do({ type: 'startClock' }, { type: 'timeout', team: 'home' })
    expect(s.heard).toEqual(['timeout'])
    s.wait(31 * SEC)
    expect(s.heard).toEqual(['timeout', 'timeoutEnd'])
  })

  it('timeout chiuso riavviando il tempo: nessun segnale di fine', () => {
    const s = session().do(
      { type: 'startClock' },
      { type: 'timeout', team: 'away' },
      { type: 'startClock' },
    )
    expect(s.heard).toEqual(['timeout'])
  })

  it('nuova partita durante il primo periodo: nessuna sirena', () => {
    const s = session()
      .do({ type: 'startClock' })
      .wait(5 * SEC)
      .do({ type: 'newGame' })
    expect(s.heard).toEqual([])
  })

  it('senza intervallo, la fine periodo suona comunque', () => {
    const s = session()
    const rules = structuredClone(s.state.rules)
    rules.intermissionMs = 0
    s.do({ type: 'setRules', rules }, { type: 'startClock' }, { type: 'endPeriod' })
    expect(s.heard).toEqual(['periodEnd'])
  })

  it('annullare un gol o iniziare una nuova partita non suona', () => {
    const s = session().do({ type: 'startClock' }, { type: 'goal', team: 'home' })
    const before = s.state
    s.do({ type: 'goal', team: 'away' })
    s.set(before) // come "Annulla"
    s.do({ type: 'endPeriod' }, { type: 'newGame' })
    expect(s.heard).toEqual(['goal', 'goal', 'periodEnd'])
  })
})
