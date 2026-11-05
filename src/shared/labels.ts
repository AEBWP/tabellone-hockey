import type { GameView } from '../engine'

/** Nome del periodo per il tabellone, es. "2° TEMPO", "SUPPLEMENTARE 2". */
export function periodLabel(
  view: Pick<GameView, 'period' | 'periodKind' | 'overtimeNumber'>,
): string {
  if (view.periodKind === 'overtime') {
    return view.overtimeNumber > 1 ? `SUPPLEMENTARE ${view.overtimeNumber}` : 'SUPPLEMENTARE'
  }
  return `${view.period}° TEMPO`
}

/** Etichetta della fase da mostrare sopra il tempo. */
export function phaseLabel(view: GameView): string {
  switch (view.phase) {
    case 'intermission':
      return 'INTERVALLO'
    case 'shootout':
      return 'RIGORI'
    case 'final':
      if (view.shootout) return 'FINALE · DOPO I RIGORI'
      if (view.periodKind === 'overtime') return 'FINALE · DOPO IL SUPPLEMENTARE'
      return 'FINALE'
    default:
      return periodLabel(view)
  }
}

/** Periodo appena concluso, durante l'intervallo prima di `view.period`. */
export function previousPeriodLabel(
  view: Pick<GameView, 'period' | 'periodKind' | 'overtimeNumber'>,
): string {
  const wasOvertime = view.periodKind === 'overtime' && view.overtimeNumber > 1
  return periodLabel({
    period: view.period - 1,
    periodKind: wasOvertime ? 'overtime' : 'regular',
    overtimeNumber: wasOvertime ? view.overtimeNumber - 1 : 0,
  })
}

/**
 * Dimensione del carattere (px) perché un testo in maiuscolo stia in
 * `widthPx`: parte da `maxPx` e rimpicciolisce i nomi lunghi.
 * Stima per Barlow Condensed in grassetto: circa mezzo em per lettera.
 */
export function fitFontSize(text: string, maxPx: number, widthPx: number): number {
  const letters = Math.max(1, text.trim().length)
  return Math.max(Math.round(maxPx * 0.55), Math.min(maxPx, Math.floor(widthPx / (letters * 0.52))))
}
