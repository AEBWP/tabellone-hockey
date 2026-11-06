import { describe, expect, it } from 'vitest'
import { advance, apply, createGame, type Command } from './game'
import { rulesFromPreset, type Rules } from './rules'
import { deriveView } from './view'
import type { GameState } from './types'

const SEC = 1_000
const MIN = 60 * SEC
const T0 = 1_000_000
/** Primo ingaggio: prima di avviare il tempo i comandi di gioco sono bloccati. */
const KICKOFF: Command[] = [{ type: 'startClock' }, { type: 'stopClock' }]

/** Piccolo aiutante: una partita con un orologio finto che si sposta a mano. */
function game(rules: Rules = rulesFromPreset('senior')) {
  let state: GameState = createGame(rules)
  let now = T0
  return {
    get state() {
      return state
    },
    get now() {
      return now
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

describe('cronometro', () => {
  it('parte dal tempo pieno e fermo', () => {
    const v = game().view()
    expect(v.phase).toBe('ready')
    expect(v.period).toBe(1)
    expect(v.clockText).toBe('20:00')
    expect(v.clockRunning).toBe(false)
  })

  it('scorre solo quando è in moto', () => {
    const g = game()
      .do({ type: 'startClock' })
      .wait(30 * SEC)
    expect(g.view().clockText).toBe('19:30')
    expect(g.view().phase).toBe('play')

    g.do({ type: 'stopClock' }).wait(5 * MIN)
    expect(g.view().clockText).toBe('19:30')

    g.do({ type: 'toggleClock' }).wait(10 * SEC)
    expect(g.view().clockText).toBe('19:20')
  })

  it("mostra i decimi nell'ultimo minuto", () => {
    const g = game().do(
      ...KICKOFF,
      { type: 'setClock', remainingMs: 61 * SEC },
      { type: 'startClock' },
    )
    g.wait(1_500)
    expect(g.view().clockText).toBe('59.5')
  })

  it("non scende sotto zero se non viene aggiornato per un po'", () => {
    const g = game().do(
      ...KICKOFF,
      { type: 'setClock', remainingMs: 2 * SEC },
      { type: 'startClock' },
    )
    const late = deriveView(g.state, g.now + 10 * SEC)
    // Fine periodo: si passa già all'intervallo
    expect(late.phase).toBe('intermission')
  })

  it('la correzione del tempo è limitata alla durata del periodo', () => {
    const g = game().do(...KICKOFF, { type: 'setClock', remainingMs: 99 * MIN })
    expect(g.view().clockText).toBe('20:00')
    g.do({ type: 'setClock', remainingMs: -5 })
    // Tempo a zero a partita iniziata: il periodo finisce (non va in negativo)
    expect(g.view().phase).toBe('intermission')
    expect(g.view().period).toBe(2)
  })
})

describe('periodi e intervalli', () => {
  it("a fine periodo parte l'intervallo nell'istante esatto", () => {
    const g = game()
      .do({ type: 'startClock' })
      .wait(20 * MIN + 3 * MIN)
    const v = g.view()
    expect(v.phase).toBe('intermission')
    expect(v.period).toBe(2)
    // L'intervallo è iniziato 3 minuti fa
    expect(v.intermission?.text).toBe('12:00')
    expect(v.clockText).toBe('20:00')
  })

  it('a fine intervallo il periodo successivo è pronto', () => {
    const g = game()
      .do({ type: 'startClock' })
      .wait(20 * MIN)
      .wait(15 * MIN)
    expect(g.view().phase).toBe('ready')
    expect(g.view().period).toBe(2)
    expect(g.view().intermission).toBeNull()
  })

  it("l'operatore può chiudere prima l'intervallo", () => {
    const g = game().do(...KICKOFF, { type: 'endPeriod' }, { type: 'endIntermission' })
    expect(g.view().phase).toBe('ready')
    expect(g.view().period).toBe(2)
  })

  it('senza intervallo il periodo successivo è subito pronto', () => {
    const rules = rulesFromPreset('senior')
    rules.intermissionMs = 0
    const g = game(rules).do(...KICKOFF, { type: 'endPeriod' })
    expect(g.view().phase).toBe('ready')
    expect(g.view().period).toBe(2)
  })

  it('a fine terzo periodo senza parità la partita è finita', () => {
    const g = game().do(
      ...KICKOFF,
      { type: 'goal', team: 'home' },
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'endPeriod' },
      { type: 'endIntermission' },
      { type: 'endPeriod' },
    )
    expect(g.view().phase).toBe('final')
  })
})

/** Porta la partita alla fine del terzo periodo. */
function toEndOfRegulation(g: ReturnType<typeof game>) {
  return g.do(
    ...KICKOFF,
    { type: 'endPeriod' },
    { type: 'endIntermission' },
    { type: 'endPeriod' },
    { type: 'endIntermission' },
    { type: 'endPeriod' },
  )
}

describe('supplementare e rigori', () => {
  it('in parità si va al supplementare 3 contro 3', () => {
    const g = toEndOfRegulation(game())
    const v = g.view()
    expect(v.phase).toBe('ready')
    expect(v.periodKind).toBe('overtime')
    expect(v.overtimeNumber).toBe(1)
    expect(v.clockText).toBe('5:00')
    expect(v.teams.home.skaters).toBe(3)
  })

  it('il gol nel supplementare chiude la partita', () => {
    const g = toEndOfRegulation(game())
      .do({ type: 'startClock' })
      .wait(MIN)
      .do({ type: 'goal', team: 'away' })
    const v = g.view()
    expect(v.phase).toBe('final')
    expect(v.clockRunning).toBe(false)
    expect(v.clockText).toBe('4:00')
    expect(v.teams.away.score).toBe(1)
  })

  it('supplementare senza gol: rigori', () => {
    const g = toEndOfRegulation(game()).do({ type: 'endPeriod' })
    expect(g.view().phase).toBe('shootout')
  })

  it('i rigori assegnano un gol al vincitore', () => {
    const g = toEndOfRegulation(game()).do({ type: 'endPeriod' })
    g.do(
      { type: 'shootoutAttempt', team: 'home', scored: true },
      { type: 'shootoutAttempt', team: 'away', scored: false },
      { type: 'shootoutAttempt', team: 'home', scored: true },
      { type: 'shootoutAttempt', team: 'away', scored: false },
    )
    const v = g.view()
    expect(v.phase).toBe('final')
    expect(v.shootout?.winner).toBe('home')
    expect(v.teams.home.score).toBe(1)
    expect(v.teams.home.goals).toBe(0)
  })

  it('playoff: supplementari a oltranza con intervallo, niente rigori', () => {
    const g = toEndOfRegulation(game(rulesFromPreset('senior-playoff')))
    expect(g.view().phase).toBe('intermission')
    g.do({ type: 'endIntermission' }, { type: 'endPeriod' })
    expect(g.view().phase).toBe('intermission')
    expect(g.view().overtimeNumber).toBe(2)
    expect(g.view().clockText).toBe('20:00')
    expect(g.view().teams.home.skaters).toBe(5)
  })

  it('giovanili: niente supplementare, finisce in parità', () => {
    const g = toEndOfRegulation(game(rulesFromPreset('giovanili')))
    expect(g.view().phase).toBe('final')
  })
})

describe('gol e tiri', () => {
  it('conta gol e tiri, registrando il momento del gol', () => {
    const g = game()
      .do({ type: 'startClock' })
      .wait(3 * MIN + 12 * SEC)
      .do({ type: 'goal', team: 'home', player: '17' }, { type: 'shot', team: 'away', delta: 2 })
    const v = g.view()
    expect(v.teams.home.score).toBe(1)
    expect(v.teams.away.shots).toBe(2)
    const goal = g.state.events.find((e) => e.type === 'goal')
    expect(goal).toMatchObject({ team: 'home', player: '17', period: 1, periodElapsedMs: 192_000 })
  })

  it('i tiri non scendono sotto zero', () => {
    const g = game().do({ type: 'shot', team: 'home', delta: -3 })
    expect(g.view().teams.home.shots).toBe(0)
  })

  it('correzione manuale del punteggio', () => {
    const g = game().do(...KICKOFF, { type: 'setScore', team: 'away', goals: 4 })
    expect(g.view().teams.away.score).toBe(4)
  })
})

describe('timeout', () => {
  it('ferma il tempo, dura 30 secondi e si chiude da solo', () => {
    const g = game()
      .do({ type: 'startClock' })
      .wait(MIN)
      .do({ type: 'timeout', team: 'home' })
      .wait(10 * SEC)
    let v = g.view()
    expect(v.clockRunning).toBe(false)
    expect(v.timeout).toMatchObject({ team: 'home', text: '0:20' })

    g.wait(25 * SEC)
    v = g.view()
    expect(v.timeout).toBeNull()
    expect(v.teams.home.timeoutsLeft).toBe(0)
  })

  it('massimo un timeout per squadra', () => {
    const g = game()
      .do({ type: 'startClock' }, { type: 'timeout', team: 'home' }, { type: 'endTimeout' })
      .do({ type: 'timeout', team: 'home' })
    expect(g.view().timeout).toBeNull()
  })

  it('riavviando il tempo il timeout termina', () => {
    const g = game().do(
      { type: 'startClock' },
      { type: 'timeout', team: 'away' },
      { type: 'startClock' },
    )
    expect(g.view().timeout).toBeNull()
    expect(g.view().clockRunning).toBe(true)
  })
})

describe('nuova partita', () => {
  it('azzera tutto mantenendo squadre e regole', () => {
    const g = game()
      .do({ type: 'setTeam', team: 'home', setup: { name: 'Castori' } })
      .do({ type: 'startClock' })
      .wait(MIN)
      .do({ type: 'goal', team: 'home' }, { type: 'newGame' })
    const v = g.view()
    expect(v.teams.home.name).toBe('Castori')
    expect(v.teams.home.score).toBe(0)
    expect(v.clockText).toBe('20:00')
    expect(v.phase).toBe('ready')
  })
})

describe('logo squadra', () => {
  it('si imposta, si rimuove e resta con una nuova partita', () => {
    const logo = 'data:image/png;base64,AAAA'
    const g = game().do({ type: 'setTeam', team: 'away', setup: { logo } })
    expect(g.view().teams.away.logo).toBe(logo)
    expect(g.view().teams.home.logo).toBeNull()

    g.do({ type: 'newGame' })
    expect(g.view().teams.away.logo).toBe(logo)

    g.do({ type: 'setTeam', team: 'away', setup: { logo: null } })
    expect(g.view().teams.away.logo).toBeNull()
  })
})

describe('mostra/nascondi loghi', () => {
  const logo = 'data:image/png;base64,AAAA'

  it('di default mostra solo i loghi che ci sono', () => {
    const g = game().do({ type: 'setTeam', team: 'home', setup: { logo } })
    expect(g.view().teams.home.logo).toBe(logo)
    expect(g.view().teams.away.logo).toBeNull()
  })

  it('si possono nascondere per tutti e due, senza perderli', () => {
    const g = game()
      .do({ type: 'setTeam', team: 'home', setup: { logo } })
      .do({ type: 'setShowLogos', show: false })
    expect(g.view().teams.home.logo).toBeNull()
    expect(g.state.teams.home.logo).toBe(logo)

    g.do({ type: 'setShowLogos', show: true })
    expect(g.view().teams.home.logo).toBe(logo)
  })

  it('una nuova partita torna a mostrarli', () => {
    const g = game()
      .do({ type: 'setTeam', team: 'home', setup: { logo } })
      .do({ type: 'setShowLogos', show: false }, { type: 'newGame' })
    expect(g.state.showLogos).toBe(true)
    expect(g.view().teams.home.logo).toBe(logo)
  })
})

describe('presentazione prima della partita', () => {
  it('è attiva finché il tempo non parte', () => {
    const g = game()
    expect(g.view().pregame).toBe(true)
    g.do({ type: 'setTeam', team: 'home', setup: { name: 'Castori' } })
    expect(g.view().pregame).toBe(true)
    g.do({ type: 'startClock' })
    expect(g.view().pregame).toBe(false)
  })

  it('non torna se si ferma il tempo o in un periodo successivo', () => {
    const g = game()
      .do({ type: 'startClock' })
      .wait(5 * SEC)
      .do({ type: 'stopClock' })
    expect(g.view().pregame).toBe(false)
    g.do({ type: 'endPeriod' }, { type: 'endIntermission' })
    expect(g.view().phase).toBe('ready')
    expect(g.view().pregame).toBe(false)
  })

  it('prima del via i comandi di gioco sono ignorati', () => {
    const g = game()
    const before = g.state
    g.do(
      { type: 'goal', team: 'home' },
      { type: 'setScore', team: 'away', goals: 2 },
      { type: 'shot', team: 'home', delta: 1 },
      { type: 'penalty', team: 'home', player: '9', kind: 'minor' },
      { type: 'timeout', team: 'away' },
      { type: 'setClock', remainingMs: 5 * MIN },
      { type: 'endPeriod' },
      { type: 'endGame' },
    )
    expect(g.state).toEqual(before)
    expect(g.view().pregame).toBe(true)
  })

  it('squadre, stile e regolamento restano modificabili prima del via', () => {
    const g = game().do(
      { type: 'setTeam', team: 'home', setup: { name: 'Castori' } },
      { type: 'setBoardStyle', style: 'retro' },
    )
    expect(g.state.teams.home.name).toBe('Castori')
    expect(g.state.boardStyle).toBe('retro')
  })

  it('dopo il via gol e correzioni sono liberi anche a tempo fermo', () => {
    const g = game().do(
      ...KICKOFF,
      { type: 'goal', team: 'home' },
      { type: 'setScore', team: 'away', goals: 2 },
    )
    expect(g.view().teams.home.score).toBe(1)
    expect(g.view().teams.away.score).toBe(2)
  })

  it('torna con una nuova partita', () => {
    const g = game().do({ type: 'startClock' }, { type: 'newGame' })
    expect(g.view().pregame).toBe(true)
  })
})

describe('stile del tabellone', () => {
  it('di default è Arena e si può cambiare', () => {
    const g = game()
    expect(g.state.boardStyle).toBe('arena')
    g.do({ type: 'setBoardStyle', style: 'classico' })
    expect(g.state.boardStyle).toBe('classico')
  })

  it('resta uguale con una nuova partita', () => {
    const g = game().do({ type: 'setBoardStyle', style: 'classico' }, { type: 'newGame' })
    expect(g.state.boardStyle).toBe('classico')
  })

  it('ignora stili sconosciuti', () => {
    const g = game().do({ type: 'setBoardStyle', style: 'neon' as never })
    expect(g.state.boardStyle).toBe('arena')
  })
})

describe('immutabilità', () => {
  it('apply e advance non modificano lo stato ricevuto', () => {
    const start = createGame()
    const copy = structuredClone(start)
    apply(start, { type: 'startClock' }, T0)
    advance(start, T0 + MIN)
    expect(start).toEqual(copy)
  })
})

describe('advance senza passaggi dovuti', () => {
  it('restituisce lo stesso stato (nessuna copia) e dà lo stesso risultato della copia', () => {
    const g = game().do(
      { type: 'startClock' },
      { type: 'penalty', team: 'home', player: '7', kind: 'minor' },
    )
    const s = g.state
    expect(advance(s, g.now + 1000)).toBe(s)
    // Alla scadenza della penalità, invece, lo stato cambia (in una copia).
    const later = advance(s, g.now + 3 * MIN)
    expect(later).not.toBe(s)
    expect(later.penalties[0].status).toBe('ended')
    expect(s.penalties[0].status).toBe('active')
  })
})
