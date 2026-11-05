import { describe, expect, it } from 'vitest'
import { advance, apply, createGame, type Command } from './game'
import { pushHistory, undo, type HistoryEntry } from './history'
import { rulesFromPreset } from './rules'
import { shootoutWinner } from './shootout'
import type { GameState, PenaltyKind } from './types'
import { deriveView } from './view'

const SEC = 1_000
const MIN = 60 * SEC
const T0 = 1_000_000
/** Primo ingaggio: prima di avviare il tempo i comandi di gioco sono bloccati. */
const KICKOFF: Command[] = [{ type: 'startClock' }, { type: 'stopClock' }]

function game(preset = 'senior') {
  let state: GameState = createGame(rulesFromPreset(preset))
  let now = T0
  return {
    get state() {
      return state
    },
    set state(s: GameState) {
      state = s
    },
    do(...commands: Command[]) {
      for (const c of commands) state = apply(state, c, now)
      return this
    },
    wait(ms: number) {
      now += ms
      state = advance(state, now)
      return this
    },
    view() {
      return deriveView(state, now)
    },
  }
}

const pen = (team: 'home' | 'away', player: string, kind: PenaltyKind = 'minor'): Command => ({
  type: 'penalty',
  team,
  player,
  kind,
})

describe('penalità', () => {
  it('scorrono solo con il tempo di gioco', () => {
    const g = game()
      .do({ type: 'startClock' }, pen('home', '12'))
      .wait(30 * SEC)
    expect(g.view().teams.home.penalties[0].text).toBe('1:30')

    g.do({ type: 'stopClock' }).wait(MIN)
    expect(g.view().teams.home.penalties[0].text).toBe('1:30')
  })

  it('superiorità numerica 5 contro 4 e fine automatica', () => {
    const g = game().do({ type: 'startClock' }, pen('away', '7'))
    let v = g.view()
    expect(v.teams.home.skaters).toBe(5)
    expect(v.teams.away.skaters).toBe(4)
    expect(v.powerPlay).toBe('home')

    g.wait(2 * MIN)
    v = g.view()
    expect(v.teams.away.penalties).toHaveLength(0)
    expect(v.powerPlay).toBeNull()
  })

  it('massimo due penalizzati: la terza aspetta e parte quando si libera un posto', () => {
    const g = game()
      .do({ type: 'startClock' }, pen('home', '1'))
      .wait(30 * SEC)
      .do(pen('home', '2'), pen('home', '3'))

    let v = g.view()
    expect(v.teams.home.skaters).toBe(3)
    expect(v.teams.home.penalties.map((p) => [p.player, p.queued])).toEqual([
      ['1', false],
      ['2', false],
      ['3', true],
    ])

    // La prima finisce a 2:00 di gioco: la terza parte in quell'istante esatto,
    // anche se lo stato viene aggiornato solo 20 secondi dopo.
    g.wait(MIN + 50 * SEC)
    v = g.view()
    const third = v.teams.home.penalties.find((p) => p.player === '3')!
    expect(third.queued).toBe(false)
    expect(third.text).toBe('1:40')
    expect(v.teams.home.skaters).toBe(3)
  })

  it('le penalità continuano nel periodo successivo', () => {
    const g = game()
      .do(
        ...KICKOFF,
        { type: 'setClock', remainingMs: 30 * SEC },
        { type: 'startClock' },
        pen('away', '4'),
      )
      .wait(30 * SEC)
      .do({ type: 'endIntermission' })
    let v = g.view()
    expect(v.period).toBe(2)
    expect(v.teams.away.penalties[0].text).toBe('1:30')
    // Anche a periodo non ancora iniziato la superiorità è indicata
    expect(v.powerPlay).toBe('home')

    g.do({ type: 'startClock' }).wait(90 * SEC)
    v = g.view()
    expect(v.teams.away.penalties).toHaveLength(0)
  })

  it('la correzione del cronometro non cambia le penalità', () => {
    const g = game()
      .do({ type: 'startClock' }, pen('home', '9'))
      .wait(20 * SEC)
    g.do({ type: 'setClock', remainingMs: 15 * MIN })
    expect(g.view().teams.home.penalties[0].text).toBe('1:40')
    expect(g.view().clockText).toBe('15:00')
  })

  it('chiusura manuale e cancellazione fanno partire quella in coda', () => {
    const g = game().do(
      { type: 'startClock' },
      pen('home', '1'),
      pen('home', '2'),
      pen('home', '3'),
    )
    const [first, second] = g.state.penalties
    g.do({ type: 'endPenalty', id: first.id })
    expect(g.state.penalties.find((p) => p.player === '3')?.status).toBe('active')
    expect(g.state.penalties.find((p) => p.player === '1')?.endedBy).toBe('manual')

    g.do({ type: 'removePenalty', id: second.id })
    expect(g.state.penalties.map((p) => p.player)).toEqual(['1', '3'])
    expect(g.state.events.filter((e) => e.type === 'penalty')).toHaveLength(2)
  })

  it('cattiva condotta: il giocatore esce ma la squadra resta al completo', () => {
    const g = game().do(
      { type: 'startClock' },
      pen('home', '5', 'misconduct'),
      pen('home', '6'),
      pen('home', '7'),
    )
    const v = g.view()
    expect(v.teams.home.skaters).toBe(3)
    expect(v.teams.home.penalties.every((p) => !p.queued)).toBe(true)
    expect(v.teams.home.penalties.find((p) => p.player === '5')?.text).toBe('10:00')
  })
})

describe('gol in superiorità numerica', () => {
  it('chiude la minore', () => {
    const g = game()
      .do({ type: 'startClock' }, pen('away', '7'))
      .wait(40 * SEC)
    g.do({ type: 'goal', team: 'home' })
    const v = g.view()
    expect(v.teams.away.penalties).toHaveLength(0)
    expect(g.state.penalties[0].endedBy).toBe('goal')
    expect(g.state.events.at(-1)).toMatchObject({ type: 'goal', powerPlay: true })
  })

  it('chiude la minore con meno tempo rimanente', () => {
    const g = game()
      .do({ type: 'startClock' }, pen('away', '1'))
      .wait(MIN)
      .do(pen('away', '2'))
      .do({ type: 'goal', team: 'home' })
    const left = g.view().teams.away.penalties.map((p) => p.player)
    expect(left).toEqual(['2'])
  })

  it('non chiude la maggiore', () => {
    const g = game().do({ type: 'startClock' }, pen('away', '7', 'major'))
    g.do({ type: 'goal', team: 'home' })
    expect(g.view().teams.away.penalties).toHaveLength(1)
    expect(g.state.events.at(-1)).toMatchObject({ powerPlay: true })
  })

  it('doppia minore: chiude solo la parte in corso', () => {
    const g = game()
      .do({ type: 'startClock' }, pen('away', '7', 'double-minor'))
      .wait(30 * SEC)
    g.do({ type: 'goal', team: 'home' })
    expect(g.view().teams.away.penalties[0].text).toBe('2:00')

    g.wait(MIN).do({ type: 'goal', team: 'home' })
    expect(g.view().teams.away.penalties).toHaveLength(0)
  })

  it('in parità numerica (4 contro 4) non chiude nulla', () => {
    const g = game().do({ type: 'startClock' }, pen('away', '7'), pen('home', '8'))
    g.do({ type: 'goal', team: 'home' })
    expect(g.view().teams.away.penalties).toHaveLength(1)
    expect(g.state.events.at(-1)).toMatchObject({ powerPlay: false, shortHanded: false })
  })

  it('gol in inferiorità numerica non chiude penalità', () => {
    const g = game().do({ type: 'startClock' }, pen('home', '8'))
    g.do({ type: 'goal', team: 'home' })
    expect(g.view().teams.home.penalties).toHaveLength(1)
    expect(g.state.events.at(-1)).toMatchObject({ powerPlay: false, shortHanded: true })
  })

  it('a tempo fermo dopo la fine non si applica la regola', () => {
    const g = game().do(...KICKOFF, { type: 'endPeriod' }, pen('away', '7'), {
      type: 'goal',
      team: 'home',
    })
    // Periodo finito (intervallo): il gol è una correzione
    expect(g.view().teams.away.penalties).toHaveLength(1)
  })
})

describe('supplementare 3 contro 3', () => {
  it("con una penalità l'avversario passa a 4", () => {
    const g = game().do(
      ...KICKOFF,
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'endPeriod' },
      { type: 'startClock' },
      pen('away', '3'),
    )
    let v = g.view()
    expect(v.teams.home.skaters).toBe(4)
    expect(v.teams.away.skaters).toBe(3)
    expect(v.powerPlay).toBe('home')

    g.do(pen('away', '4'))
    v = g.view()
    expect(v.teams.home.skaters).toBe(5)
    expect(v.teams.away.skaters).toBe(3)
  })
})

describe('rigori', () => {
  it('si chiudono appena una squadra non è più raggiungibile', () => {
    expect(shootoutWinner({ home: [true, true], away: [false, false] }, 3)).toBe('home')
    expect(shootoutWinner({ home: [true, true], away: [false] }, 3)).toBeNull()
    expect(shootoutWinner({ home: [true, false, false], away: [true, false, false] }, 3)).toBeNull()
  })

  it('morte improvvisa a coppie di tiri', () => {
    const base = [true, false, false]
    expect(shootoutWinner({ home: [...base, true], away: [...base] }, 3)).toBeNull()
    expect(shootoutWinner({ home: [...base, true], away: [...base, false] }, 3)).toBe('home')
    expect(shootoutWinner({ home: [...base, true], away: [...base, true] }, 3)).toBeNull()
  })
})

describe('annulla ultima azione', () => {
  it('annulla il gol senza toccare il cronometro', () => {
    const g = game().do({ type: 'startClock' }).wait(MIN)
    let history: HistoryEntry[] = []
    history = pushHistory(history, 'Gol Casa', g.state)
    g.do({ type: 'goal', team: 'home' }).wait(MIN)

    const result = undo(history, g.state)!
    g.state = result.state
    const v = g.view()
    expect(result.label).toBe('Gol Casa')
    expect(v.teams.home.score).toBe(0)
    expect(v.clockText).toBe('18:00')
    expect(v.clockRunning).toBe(true)
  })

  it('annullare il gol decisivo del supplementare riapre la partita', () => {
    const g = game().do(
      ...KICKOFF,
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'endPeriod' },
      { type: 'startClock' },
    )
    const history = pushHistory([], 'Gol Ospiti', g.state)
    g.do({ type: 'goal', team: 'away' })
    expect(g.view().phase).toBe('final')

    g.state = undo(history, g.state)!.state
    expect(g.view().phase).toBe('play')
    expect(g.view().teams.away.score).toBe(0)
  })

  it('non annulla azioni di un periodo precedente', () => {
    const g = game().do(...KICKOFF)
    const history = pushHistory([], 'Gol Casa', g.state)
    g.do({ type: 'goal', team: 'home' }, { type: 'endPeriod' }, { type: 'endIntermission' })
    expect(undo(history, g.state)).toBeNull()
  })
})
