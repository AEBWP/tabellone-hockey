import type { BoardStyle } from '../engine'

/** Descrizione degli stili del tabellone, per la scelta nella console. */
export const STYLE_INFO: Record<BoardStyle, { name: string; description: string }> = {
  arena: {
    name: 'Arena',
    description:
      'Pannelli incorniciati e cifre da display, come nei palazzetti professionistici. Gol in stile TV con fascia diagonale e barra del punteggio.',
  },
  classico: {
    name: 'Classico',
    description:
      'Grafica morbida con sfumature e bagliori, punteggi molto grandi. Gol a tutto schermo nel colore della squadra con raggi luminosi.',
  },
}
