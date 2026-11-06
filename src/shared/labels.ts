/**
 * Dimensione del carattere (px) perché un testo in maiuscolo stia in
 * `widthPx`: parte da `maxPx` e rimpicciolisce i nomi lunghi.
 * Stima per Barlow Condensed in grassetto: circa mezzo em per lettera.
 */
export function fitFontSize(text: string, maxPx: number, widthPx: number): number {
  const letters = Math.max(1, text.trim().length)
  return Math.max(Math.round(maxPx * 0.55), Math.min(maxPx, Math.floor(widthPx / (letters * 0.52))))
}
