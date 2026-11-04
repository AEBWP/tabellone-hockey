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

In sviluppo la console è su `http://localhost:5173/` (premi `F1` per la guida rapida). Il pulsante
**Apri tabellone** apre il tabellone in una nuova finestra: trascinala sul
secondo schermo e fai **doppio clic** per lo schermo intero.

Per vedere la grafica del tabellone senza la console apri
`http://localhost:5173/display.html?demo`: i tasti da `1` a `8` mostrano le
varie situazioni (penalità, ultimo minuto, timeout, intervallo, supplementare,
rigori, finale), `G` e `H` simulano un gol, `L` mostra o nasconde i loghi.

## Struttura

```
index.html          pagina della console operatore
display.html        pagina del tabellone spettatori
src/
  engine/           motore di gioco: sola logica, coperto da test
  shared/           comunicazione tra console e tabellone
  console/          interfaccia della console operatore
  display/          finestra del tabellone spettatori (e demo)
  scoreboard/       grafica del tabellone spettatori
  styles/           stili comuni
public/             file statici (icone, suoni, loghi)
```
