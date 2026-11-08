/**
 * Display alfanumerico a 14 segmenti: quali segmenti accendere per ogni carattere.
 * Nomi: a in alto, b-c a destra, d in basso, e-f a sinistra, g-p al centro
 * (sinistra-destra), h-i-j le diagonali e la verticale in alto, k-l-m in basso.
 */
export const SEGMENT_NAMES = 'abcdefgphijklm'

const GLYPHS: Record<string, string> = {
  A: 'abcefgp',
  B: 'abcdpil',
  C: 'adef',
  D: 'abcdil',
  E: 'adefgp',
  F: 'aefgp',
  G: 'acdefp',
  H: 'bcefgp',
  I: 'adil',
  J: 'bcde',
  K: 'efgjm',
  L: 'def',
  M: 'bcefhj',
  N: 'bcefhm',
  O: 'abcdef',
  P: 'abefgp',
  Q: 'abcdefm',
  R: 'abefgpm',
  S: 'acdfgp',
  T: 'ail',
  U: 'bcdef',
  V: 'efjk',
  W: 'bcefkm',
  X: 'hjkm',
  Y: 'hjl',
  Z: 'adjk',
  '0': 'abcdefjk',
  '1': 'bc',
  '2': 'abdegp',
  '3': 'abcdp',
  '4': 'bcfgp',
  '5': 'acdfgp',
  '6': 'acdefgp',
  '7': 'abc',
  '8': 'abcdefgp',
  '9': 'abcdfgp',
  '-': 'gp',
  '+': 'gpil',
  '/': 'jk',
  '!': 'il',
  '¡': 'il',
  '¿': 'ad',
  '°': 'abfgp',
  "'": 'i',
  ' ': '',
}

/** Punteggiatura disegnata a punti invece che a segmenti. */
export const DOTS: Record<string, [number, number][]> = {
  ':': [
    [32, 32],
    [32, 68],
  ],
  '.': [[32, 90]],
  '·': [[32, 50]],
}

/** Il display ha solo maiuscole senza accenti: "Città" diventa "CITTA". */
export function displayText(text: string): string {
  // Gli spazi speciali (come quello del francese prima di "!") contano come spazi normali.
  return text.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s/g, ' ')
}

export function isDrawable(ch: string): boolean {
  return ch in GLYPHS || ch in DOTS
}

/** I segmenti accesi per un carattere già passato da `displayText`. */
export function litSegments(ch: string): string {
  return GLYPHS[ch] ?? ''
}

/** Larghezza di un carattere rispetto all'altezza. */
const CHAR_RATIO = 0.72

/** Altezza del display perché il testo stia in `widthPx`, senza superare `maxPx`. */
export function fitSegmentHeight(text: string, maxPx: number, widthPx: number): number {
  const chars = Math.max(1, displayText(text).trim().length)
  return Math.min(maxPx, Math.max(28, Math.floor(widthPx / (chars * CHAR_RATIO))))
}
