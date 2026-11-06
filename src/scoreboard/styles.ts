import type { BoardStyle } from '../engine'

/** Descrizione degli stili del tabellone, per la scelta nella console. */
export const STYLE_INFO: Record<BoardStyle, { name: string; description: string }> = {
  arena: {
    name: 'Arena',
    description:
      'Pannelli incorniciati e cifre da display, come nei palazzetti professionistici. Gol in stile TV con fascia diagonale e barra del punteggio.',
  },
  broadcast: {
    name: 'Broadcast',
    description:
      'Grafica piatta da diretta TV: colori pieni, punteggi su riquadri bianchi, tempo grande al centro. Gol con due ante che si chiudono sul tabellone.',
  },
  ghiaccio: {
    name: 'Ghiaccio',
    description:
      'Stile chiaro da torneo internazionale: schede bianche, testi blu notte e colori delle squadre come accento. Gol con un cerchio di colore che si allarga come un’onda sul ghiaccio.',
  },
  retro: {
    name: 'Retrò',
    description:
      'Il vecchio tabellone a lampadine: cifre a 7 segmenti, scritte a puntini, loghi pixelati. Gol con insegna lampeggiante e scritta che scorre.',
  },
  classico: {
    name: 'Classico',
    description:
      'Grafica morbida con sfumature e bagliori, punteggi molto grandi. Gol a tutto schermo nel colore della squadra con raggi luminosi.',
  },
  palette: {
    name: 'Palette',
    description:
      'Il vecchio tabellone a palette: cifre chiare su tessere scure che girano quando cambiano, testi molto grandi. Gol con le tessere che compongono la scritta una dopo l’altra.',
  },
  essenziale: {
    name: 'Essenziale',
    description:
      'Fondo nero e cifre bianche enormi, il colore delle squadre solo come fascia: si legge bene da lontano ed è leggero anche sui PC meno potenti. Gol con il colore della squadra che copre lo schermo.',
  },
}
