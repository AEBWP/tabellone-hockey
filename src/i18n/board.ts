import type { GameView, Language } from '../engine'

/**
 * Scritte del tabellone per il pubblico, in ogni lingua.
 * Si usano i termini dell'hockey su ghiaccio di ciascun paese
 * (es. "1. DRITTEL", "1ER TIERS", "POWER PLAY").
 */

/** Il periodo di cui si parla: in corso, appena finito o il prossimo. */
export type PeriodRef = Pick<
  GameView,
  'period' | 'periodKind' | 'overtimeNumber' | 'regularPeriods'
>

export interface BoardText {
  vs: string
  gameStart: string
  /** Scritta grande dell'animazione del gol, senza e con il punto esclamativo. */
  goal: string
  goalExclaimed: string
  /** "2° TEMPO", "SUPPLEMENTARE 2"… */
  period: (p: PeriodRef) => string
  /** "FINE 2° TEMPO" (durante l'intervallo). */
  endOf: (p: PeriodRef) => string
  /** "IL 2° TEMPO INIZIA TRA" (sopra al conto alla rovescia dell'intervallo). */
  startsIn: (p: PeriodRef) => string
  /** Versione corta: "2° TEMPO TRA". */
  startsInShort: (p: PeriodRef) => string
  /** "PROSSIMO: 2° TEMPO". */
  next: (p: PeriodRef) => string
  /** "INTERVALLO · POI 2° TEMPO". */
  intermissionThen: (p: PeriodRef) => string
  /** Parola "periodo" da sola (es. sopra al numero del periodo). */
  periodWord: (regularPeriods: number) => string
  /** Numero del periodo nel riquadro piccolo: "2°", "2ND", "2."… */
  periodNumber: (n: number) => string
  /** Sigle corte per il riquadro piccolo (supplementare, rigori). */
  overtimeShort: string
  overtimeAbbr: string
  shootoutShort: string
  intermission: string
  shootout: string
  final: string
  /** Parole brevi per il riquadro grande al centro (al posto del tempo). */
  finalShort: string
  shootoutWord: string
  /** Didascalia piccola sotto la sigla dei rigori. */
  shootoutAbbr: string
  finalAfterShootout: string
  finalAfterOvertime: string
  shootoutGoals: string
  result: string
  ready: string
  time: string
  timeStopped: string
  live: string
  stopped: string
  powerPlay: string
  /** Giocatori in campo: "5 CONTRO 3". */
  strength: (home: number, away: number) => string
  timeout: string
  timeoutAbbr: string
  shotsOnGoal: string
  penalties: string
  /** Penalità in coda: "+2 IN ATTESA". */
  waiting: (n: number) => string
  /** Nessuna penalità, in maiuscolo (riga vuota) e come frase. */
  none: string
  noPenalties: string
}

const isOvertime = (p: PeriodRef) => p.periodKind === 'overtime'
/** "SUPPLEMENTARE" o "SUPPLEMENTARE 2" con la parola data. */
const overtime = (word: string, p: PeriodRef) =>
  p.overtimeNumber > 1 ? `${word} ${p.overtimeNumber}` : word

// ── Italiano ────────────────────────────────────────────────────────────
const itPeriod = (p: PeriodRef) =>
  isOvertime(p) ? overtime('SUPPLEMENTARE', p) : `${p.period}° TEMPO`

const it: BoardText = {
  vs: 'VS',
  gameStart: 'INIZIO PARTITA',
  goal: 'GOAL',
  goalExclaimed: 'GOAL!',
  period: itPeriod,
  endOf: (p) => `FINE ${itPeriod(p)}`,
  startsIn: (p) => `IL ${itPeriod(p)} INIZIA TRA`,
  startsInShort: (p) => `${itPeriod(p)} TRA`,
  next: (p) => `PROSSIMO: ${itPeriod(p)}`,
  intermissionThen: (p) => `INTERVALLO · POI ${itPeriod(p)}`,
  periodWord: () => 'PERIODO',
  periodNumber: (n) => `${n}°`,
  overtimeShort: 'OT',
  overtimeAbbr: 'SUPPL.',
  shootoutShort: 'SO',
  intermission: 'INTERVALLO',
  shootout: 'RIGORI',
  final: 'FINALE',
  finalShort: 'FINALE',
  shootoutWord: 'RIGORI',
  shootoutAbbr: 'RIGORI',
  finalAfterShootout: 'FINALE · DOPO I RIGORI',
  finalAfterOvertime: 'FINALE · DOPO IL SUPPLEMENTARE',
  shootoutGoals: 'GOL AI RIGORI',
  result: 'RISULTATO',
  ready: 'PRONTI',
  time: 'TEMPO',
  timeStopped: 'TEMPO · FERMO',
  live: 'IN GIOCO',
  stopped: 'FERMO',
  powerPlay: 'SUPERIORITÀ',
  strength: (home, away) => `${home} CONTRO ${away}`,
  timeout: 'TIMEOUT',
  timeoutAbbr: 'TO',
  shotsOnGoal: 'TIRI IN PORTA',
  penalties: 'PENALITÀ',
  waiting: (n) => `+${n} IN ATTESA`,
  none: 'NESSUNA',
  noPenalties: 'Nessuna penalità',
}

// ── English ─────────────────────────────────────────────────────────────
const enOrdinal = (n: number) => {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}TH`
  return `${n}${['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'}`
}
const enPeriod = (p: PeriodRef) =>
  isOvertime(p) ? overtime('OVERTIME', p) : `${enOrdinal(p.period)} PERIOD`

const en: BoardText = {
  vs: 'VS',
  gameStart: 'FACE-OFF',
  goal: 'GOAL',
  goalExclaimed: 'GOAL!',
  period: enPeriod,
  endOf: (p) => `END OF ${enPeriod(p)}`,
  startsIn: (p) => `${enPeriod(p)} STARTS IN`,
  startsInShort: (p) => `${enPeriod(p)} IN`,
  next: (p) => `NEXT: ${enPeriod(p)}`,
  intermissionThen: (p) => `INTERMISSION · THEN ${enPeriod(p)}`,
  periodWord: () => 'PERIOD',
  periodNumber: enOrdinal,
  overtimeShort: 'OT',
  overtimeAbbr: 'OVERTIME',
  shootoutShort: 'SO',
  intermission: 'INTERMISSION',
  shootout: 'SHOOTOUT',
  final: 'FINAL',
  finalShort: 'FINAL',
  shootoutWord: 'SHOOTOUT',
  shootoutAbbr: 'SHOOTOUT',
  finalAfterShootout: 'FINAL · SHOOTOUT',
  finalAfterOvertime: 'FINAL · OVERTIME',
  shootoutGoals: 'SHOOTOUT GOALS',
  result: 'FINAL SCORE',
  ready: 'READY',
  time: 'TIME',
  timeStopped: 'TIME · STOPPED',
  live: 'LIVE',
  stopped: 'STOPPED',
  powerPlay: 'POWER PLAY',
  strength: (home, away) => `${home} ON ${away}`,
  timeout: 'TIMEOUT',
  timeoutAbbr: 'TO',
  shotsOnGoal: 'SHOTS ON GOAL',
  penalties: 'PENALTIES',
  waiting: (n) => `+${n} WAITING`,
  none: 'NONE',
  noPenalties: 'No penalties',
}

// ── Deutsch ─────────────────────────────────────────────────────────────
// Drei Spielabschnitte heißen "Drittel"; bei anderer Einteilung "Periode".
const deWord = (regular: number) => (regular === 3 ? 'DRITTEL' : 'PERIODE')
const dePeriod = (p: PeriodRef) =>
  isOvertime(p)
    ? p.overtimeNumber > 1
      ? `${p.overtimeNumber}. VERLÄNGERUNG`
      : 'VERLÄNGERUNG'
    : `${p.period}. ${deWord(p.regularPeriods)}`

const de: BoardText = {
  vs: 'VS',
  gameStart: 'SPIELBEGINN',
  goal: 'TOR',
  goalExclaimed: 'TOR!',
  period: dePeriod,
  endOf: (p) => `ENDE ${dePeriod(p)}`,
  startsIn: (p) => `${dePeriod(p)} BEGINNT IN`,
  startsInShort: (p) => `${dePeriod(p)} IN`,
  next: (p) => `ALS NÄCHSTES: ${dePeriod(p)}`,
  intermissionThen: (p) => `PAUSE · DANN ${dePeriod(p)}`,
  periodWord: deWord,
  periodNumber: (n) => `${n}.`,
  overtimeShort: 'OT',
  overtimeAbbr: 'VERL.',
  shootoutShort: 'PS',
  intermission: 'PAUSE',
  shootout: 'PENALTYSCHIESSEN',
  final: 'ENDSTAND',
  finalShort: 'ENDE',
  shootoutWord: 'PENALTYS',
  shootoutAbbr: 'PENALTYS',
  finalAfterShootout: 'ENDSTAND · N. PENALTYSCHIESSEN',
  finalAfterOvertime: 'ENDSTAND · N. VERLÄNGERUNG',
  shootoutGoals: 'TORE IM PENALTYSCHIESSEN',
  result: 'ERGEBNIS',
  ready: 'BEREIT',
  time: 'ZEIT',
  timeStopped: 'ZEIT · GESTOPPT',
  live: 'LÄUFT',
  stopped: 'GESTOPPT',
  powerPlay: 'ÜBERZAHL',
  strength: (home, away) => `${home} GEGEN ${away}`,
  timeout: 'AUSZEIT',
  timeoutAbbr: 'TO',
  shotsOnGoal: 'TORSCHÜSSE',
  penalties: 'STRAFEN',
  waiting: (n) => `+${n} WARTEND`,
  none: 'KEINE',
  noPenalties: 'Keine Strafen',
}

// ── Español ─────────────────────────────────────────────────────────────
// "Primer" y "tercer" van apocopados delante del nombre: 1.ER, 3.ER; el resto 2.º, 4.º…
const esOrdinal = (n: number) => (n === 1 || n === 3 ? `${n}.ER` : `${n}.º`)
const esPeriod = (p: PeriodRef) =>
  isOvertime(p) ? overtime('PRÓRROGA', p) : `${esOrdinal(p.period)} PERIODO`
/** Con artículo: "EL 2.º PERIODO", "LA PRÓRROGA". */
const esWithArticle = (p: PeriodRef) => `${isOvertime(p) ? 'LA' : 'EL'} ${esPeriod(p)}`

const es: BoardText = {
  vs: 'VS',
  gameStart: 'COMIENZO DEL PARTIDO',
  goal: 'GOL',
  goalExclaimed: '¡GOL!',
  period: esPeriod,
  endOf: (p) => `FIN DE ${esWithArticle(p)}`.replace('DE EL ', 'DEL '),
  startsIn: (p) => `${esWithArticle(p)} EMPIEZA EN`,
  startsInShort: (p) => `${esPeriod(p)} EN`,
  next: (p) => `SIGUIENTE: ${esPeriod(p)}`,
  intermissionThen: (p) => `DESCANSO · LUEGO ${esPeriod(p)}`,
  periodWord: () => 'PERIODO',
  periodNumber: (n) => `${n}.º`,
  overtimeShort: 'OT',
  overtimeAbbr: 'PRÓRR.',
  shootoutShort: 'SO',
  intermission: 'DESCANSO',
  shootout: 'PENALTIS',
  final: 'FINAL',
  finalShort: 'FINAL',
  shootoutWord: 'PENALTIS',
  shootoutAbbr: 'PENALTIS',
  finalAfterShootout: 'FINAL · TRAS LOS PENALTIS',
  finalAfterOvertime: 'FINAL · TRAS LA PRÓRROGA',
  shootoutGoals: 'GOLES EN LOS PENALTIS',
  result: 'RESULTADO',
  ready: 'LISTOS',
  time: 'TIEMPO',
  timeStopped: 'TIEMPO · PARADO',
  live: 'EN JUEGO',
  stopped: 'PARADO',
  powerPlay: 'SUPERIORIDAD',
  strength: (home, away) => `${home} CONTRA ${away}`,
  timeout: 'TIEMPO MUERTO',
  timeoutAbbr: 'TM',
  shotsOnGoal: 'TIROS A PUERTA',
  penalties: 'EXCLUSIONES',
  waiting: (n) => `+${n} EN ESPERA`,
  none: 'NINGUNA',
  noPenalties: 'Sin exclusiones',
}

// ── Français ────────────────────────────────────────────────────────────
// Trois périodes = "tiers" (masculin : 1ER, 2E) ; sinon "période" (féminin : 1RE, 2E).
const frThirds = (p: Pick<PeriodRef, 'regularPeriods'>) => p.regularPeriods === 3
const frOrdinal = (n: number, feminine: boolean) => (n === 1 ? (feminine ? '1RE' : '1ER') : `${n}E`)
const frPeriod = (p: PeriodRef) =>
  isOvertime(p)
    ? overtime('PROLONGATION', p)
    : frThirds(p)
      ? `${frOrdinal(p.period, false)} TIERS`
      : `${frOrdinal(p.period, true)} PÉRIODE`
/** Avec article : "LE 2E TIERS", "LA 2E PÉRIODE", "LA PROLONGATION". */
const frWithArticle = (p: PeriodRef) =>
  `${!isOvertime(p) && frThirds(p) ? 'LE' : 'LA'} ${frPeriod(p)}`

const fr: BoardText = {
  vs: 'VS',
  gameStart: 'DÉBUT DU MATCH',
  goal: 'BUT',
  // In francese prima di "!" e ":" va uno spazio (indivisibile).
  goalExclaimed: 'BUT !',
  period: frPeriod,
  endOf: (p) => `FIN DE ${frWithArticle(p)}`.replace('DE LE ', 'DU '),
  startsIn: (p) => `${frWithArticle(p)} COMMENCE DANS`,
  startsInShort: (p) => `${frPeriod(p)} DANS`,
  next: (p) => `ENSUITE : ${frPeriod(p)}`,
  intermissionThen: (p) => `PAUSE · PUIS ${frPeriod(p)}`,
  periodWord: (regular) => (regular === 3 ? 'TIERS' : 'PÉRIODE'),
  periodNumber: (n) => `${n}E`,
  overtimeShort: 'OT',
  overtimeAbbr: 'PROL.',
  shootoutShort: 'TAB',
  intermission: 'PAUSE',
  shootout: 'TIRS AU BUT',
  final: 'FIN DU MATCH',
  finalShort: 'FIN',
  shootoutWord: 'TIRS AU BUT',
  shootoutAbbr: 'TIRS',
  finalAfterShootout: 'FIN · APRÈS TIRS AU BUT',
  finalAfterOvertime: 'FIN · APRÈS PROLONGATION',
  shootoutGoals: 'BUTS AUX TIRS AU BUT',
  result: 'RÉSULTAT',
  ready: 'PRÊTS',
  time: 'TEMPS',
  timeStopped: 'TEMPS · ARRÊTÉ',
  live: 'EN JEU',
  stopped: 'ARRÊTÉ',
  powerPlay: 'SUPÉRIORITÉ',
  strength: (home, away) => `${home} CONTRE ${away}`,
  timeout: 'TEMPS MORT',
  timeoutAbbr: 'TM',
  shotsOnGoal: 'TIRS CADRÉS',
  penalties: 'PÉNALITÉS',
  waiting: (n) => `+${n} EN ATTENTE`,
  none: 'AUCUNE',
  noPenalties: 'Aucune pénalité',
}

export const BOARD_TEXT: Record<Language, BoardText> = { it, en, de, es, fr }

/** Scritte del tabellone nella lingua della partita (italiano se sconosciuta). */
export function boardText(view: Pick<GameView, 'language'>): BoardText {
  return BOARD_TEXT[view.language] ?? it
}

/** Periodo appena concluso, durante l'intervallo prima di `view.period`. */
export function previousPeriod(p: PeriodRef): PeriodRef {
  const wasOvertime = p.periodKind === 'overtime' && p.overtimeNumber > 1
  return {
    period: p.period - 1,
    periodKind: wasOvertime ? 'overtime' : 'regular',
    overtimeNumber: wasOvertime ? p.overtimeNumber - 1 : 0,
    regularPeriods: p.regularPeriods,
  }
}

/** Etichetta della fase da mostrare sopra il tempo. */
export function phaseLabel(view: GameView): string {
  const t = boardText(view)
  switch (view.phase) {
    case 'intermission':
      return t.intermission
    case 'shootout':
      return t.shootout
    case 'final':
      if (view.shootout) return t.finalAfterShootout
      if (view.periodKind === 'overtime') return t.finalAfterOvertime
      return t.final
    default:
      return t.period(view)
  }
}
