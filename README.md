# Tabellone Hockey

Tabellone segnapunti per hockey su ghiaccio, pensato per il palaghiaccio:
una **console operatore** sul PC e un **tabellone spettatori** a schermo intero
sul maxischermo. Funziona completamente **offline**.

Il piano completo è in [PIANO.md](PIANO.md).

## Requisiti per lo sviluppo

- [Node.js](https://nodejs.org/) 20 o superiore

## Comandi

```bash
npm install        # installa le dipendenze (solo la prima volta)
npm run dev        # avvia in sviluppo: apri l'indirizzo mostrato nel terminale
npm test           # esegue i test del motore di gioco
npm run check      # controllo dei tipi TypeScript/Svelte
npm run format     # formatta il codice
npm run build      # crea la versione finale in dist/
```

In sviluppo la console è su `http://localhost:5173/`. Il pulsante
**Apri tabellone** apre il tabellone in una nuova finestra: trascinala sul
secondo schermo e fai **doppio clic** per lo schermo intero.

## Struttura

```
index.html          pagina della console operatore
display.html        pagina del tabellone spettatori
src/
  engine/           motore di gioco: sola logica, coperto da test
  shared/           comunicazione tra console e tabellone
  console/          interfaccia della console operatore
  display/          grafica del tabellone spettatori
  styles/           stili comuni
public/             file statici (icone, suoni, loghi)
```
