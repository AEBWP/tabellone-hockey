// Motore di gioco: sola logica, nessuna dipendenza dalla grafica o dal browser.
// Ogni funzione riceve l'istante `now` (ms) invece di leggere l'orologio:
// così il comportamento è deterministico e verificabile con i test.
export * from './types'
export * from './rules'
export * from './clock'
export * from './penalties'
export * from './shootout'
export * from './game'
export * from './history'
export * from './view'
