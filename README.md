# Tabellone Hockey

Tabellone segnapunti per hockey su ghiaccio, pensato per il palaghiaccio:
una **console operatore** sul PC e un **tabellone spettatori** a schermo intero
sul maxischermo. Funziona completamente **offline**.

## ⬇️ Scarica

### [👉 Scarica il Tabellone Hockey per Windows (ultima versione)](https://github.com/AEBWP/tabellone-hockey/releases/latest/download/Tabellone-Hockey-installazione.exe)

Il link scarica sempre l'**ultima versione** dell'installer (`Tabellone-Hockey-installazione.exe`).
Per aggiornare basta eseguirlo di nuovo: i dati restano.
Novità di ogni versione: [pagina dell'ultima release](https://github.com/AEBWP/tabellone-hockey/releases/latest).

**Come installarlo e usarlo al palaghiaccio:** [INSTALLAZIONE.md](INSTALLAZIONE.md).

---

Il piano completo del progetto è in [PIANO.md](PIANO.md).

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
npm run app        # avvia il programma desktop (Electron)
npm run app:smoke  # collaudo automatico del programma desktop, con screenshot
npm run dist       # crea il file di installazione in release/
```

In sviluppo la console è su `http://localhost:5173/` (premi `F1` per la guida rapida). Il pulsante
**Apri tabellone** apre il tabellone in una nuova finestra: trascinala sul
secondo schermo e fai **doppio clic** per lo schermo intero.

Per vedere la grafica del tabellone senza la console apri
`http://localhost:5173/display.html?demo`: i tasti da `1` a `8` mostrano le
varie situazioni (penalità, ultimo minuto, timeout, intervallo, supplementare,
rigori, finale), `G` e `H` simulano un gol, `L` mostra o nasconde i loghi, `S` cambia stile.

## Programma desktop

`npm run app` avvia la versione desktop. Al primo avvio si sceglie su quale
schermo mostrare la console e su quale il tabellone (pulsante **Mostra il
numero su ogni schermo** per riconoscerli); la scelta può essere ricordata e
cambiata in seguito dal pulsante **Schermi…** nella console.

- il tabellone si apre a schermo intero sul maxischermo, senza barra del titolo e
  senza rubare il focus alla console; si chiude solo dalla console. Se il
  maxischermo viene scollegato torna in finestra
- all'avvio compare subito una finestra “Avvio in corso…”
- le sirene suonano subito, senza dover prima cliccare
- la partita è salvata anche su file (`partita.json` nella cartella dati
  dell'app, `%APPDATA%\Tabellone Hockey`)
- niente standby dello schermo mentre il programma è aperto
- un solo programma aperto alla volta

## Struttura

```
index.html          pagina della console operatore
display.html        pagina del tabellone spettatori
src/
  engine/           motore di gioco: sola logica, coperto da test
  shared/           comunicazione tra console e tabellone
  console/          interfaccia della console operatore
  display/          finestra del tabellone spettatori (e demo)
  scoreboard/       grafica del tabellone spettatori: arena/ e classico/ (stili)
  styles/           stili comuni
  setup/            scelta degli schermi all'avvio (programma desktop)
electron/           processo principale del programma desktop
public/             file statici (icona, identificazione schermi)
scripts/            strumenti di sviluppo (collaudo automatico)
```
