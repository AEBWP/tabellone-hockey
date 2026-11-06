import { describe, expect, it } from 'vitest'
import { createGame } from '../engine'
import { browserLanguage, nameFromPath, sanitizeState } from '../live/sanitize'
import { isValidLiveName, joinLogos, liveLink, logoHash, splitLogos, toLiveName } from './live'

describe('nome e link dello streaming', () => {
  it('trasforma un testo libero in un nome valido', () => {
    expect(toLiveName('Palaghiaccio Città di Pinè 2')).toBe('palaghiaccio-citta-di-pine-2')
    expect(toLiveName('  --HC Ëagles!!  ')).toBe('hc-eagles')
    expect(isValidLiveName(toLiveName('Palaghiaccio Città di Pinè 2'))).toBe(true)
  })

  it('rifiuta nomi troppo corti, con caratteri strani o riservati', () => {
    expect(isValidLiveName('ab')).toBe(false)
    expect(isValidLiveName('-abc')).toBe(false)
    expect(isValidLiveName('abc-')).toBe(false)
    expect(isValidLiveName('Abc')).toBe(false)
    expect(isValidLiveName('a'.repeat(41))).toBe(false)
    expect(isValidLiveName('api')).toBe(false)
    expect(isValidLiveName('assets')).toBe(false)
    expect(isValidLiveName('hc-milano')).toBe(true)
  })

  it('compone il link senza doppie barre', () => {
    expect(liveLink('https://x.dev/', 'hc-milano')).toBe('https://x.dev/hc-milano')
    expect(nameFromPath('/hc-milano')).toBe('hc-milano')
    expect(nameFromPath('/HC-Milano/')).toBe('hc-milano')
    expect(nameFromPath('/')).toBe('')
  })
})

describe('loghi inviati a parte', () => {
  it('sostituisce i loghi con un’impronta e li rimette', () => {
    const game = createGame()
    game.teams.home.logo = 'data:image/png;base64,AAAA'
    const { state, logos } = splitLogos(game)
    const hash = logoHash('data:image/png;base64,AAAA')
    expect(state.teams.home.logo).toBe(hash)
    expect(state.teams.away.logo).toBeNull()
    expect(logos).toEqual({ [hash]: 'data:image/png;base64,AAAA' })
    expect(joinLogos(state, new Map(Object.entries(logos))).teams.home.logo).toBe(
      'data:image/png;base64,AAAA',
    )
    // Logo non ancora arrivato: si mostra senza.
    expect(joinLogos(state, new Map()).teams.home.logo).toBeNull()
  })
})

describe('compatibilità con console di altre versioni', () => {
  it('stile o lingua sconosciuti diventano quelli predefiniti', () => {
    const state = { ...createGame(), boardStyle: 'stile-del-futuro', boardLanguage: 'xx' }
    const clean = sanitizeState(state, new Map(), 'de')
    expect(clean?.boardStyle).toBe('arena')
    // La lingua è quella scelta da chi guarda.
    expect(clean?.boardLanguage).toBe('de')
  })

  it('campi mancanti vengono completati, campi in più ignorati', () => {
    const { showLogos: _, ...old } = createGame()
    const clean = sanitizeState({ ...old, campoNuovo: 1 }, new Map(), 'it')
    expect(clean?.showLogos).toBe(createGame().showLogos)
    expect(sanitizeState({ nonUnoStato: true }, new Map(), 'it')).toBeNull()
    expect(sanitizeState(null, new Map(), 'it')).toBeNull()
  })

  it('lingua del browser se il tabellone la conosce', () => {
    expect(browserLanguage(['fr-CH', 'en'])).toBe('fr')
    expect(browserLanguage(['pt-BR'])).toBeNull()
  })
})

describe('tiri in porta nello streaming', () => {
  it('console precedenti (senza l’opzione): i tiri restano visibili', () => {
    const { showShots: _, ...rules } = createGame().rules
    const clean = sanitizeState({ ...createGame(), rules }, new Map(), 'it')
    expect(clean?.rules.showShots).toBe(true)
  })

  it('console nuove: vale la scelta del regolamento', () => {
    expect(sanitizeState(createGame(), new Map(), 'it')?.rules.showShots).toBe(false)
  })
})
