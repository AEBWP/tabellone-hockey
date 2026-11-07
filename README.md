# Tabellone Hockey

![Versione](https://img.shields.io/github/v/release/AEBWP/tabellone-hockey?label=versione&color=1f6feb)
![Stato: stabile](https://img.shields.io/badge/stato-stabile-2ea043)
![Windows 10 e 11](https://img.shields.io/badge/Windows-10%20%7C%2011-0078d4)
![Offline](https://img.shields.io/badge/funziona-offline-2ea043)

Tabellone segnapunti per hockey su ghiaccio, pensato per il palaghiaccio:
una **console operatore** sul PC e un **tabellone spettatori** a schermo intero
sul maxischermo. Funziona completamente **offline**; se c'è internet, la partita si può
anche seguire **in streaming** dal telefono, con un link e un QR code fissi per il palaghiaccio.

![Il tabellone sul maxischermo (stile Arena)](https://raw.githubusercontent.com/wiki/AEBWP/tabellone-hockey/images/tabellone-arena.png)

## ⬇️ Scarica

### [👉 Scarica il Tabellone Hockey per Windows (ultima versione)](https://github.com/AEBWP/tabellone-hockey/releases/latest)

| Versione            | Data       | Download                                                                                                                                                      |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1.0.0** (ultima)  | 7 nov 2026 | [⬇️ Tabellone-Hockey-1.0.0-installazione.exe](https://github.com/AEBWP/tabellone-hockey/releases/download/v1.0.0/Tabellone-Hockey-1.0.0-installazione.exe)    |
| 0.9.11 (beta)       | 7 nov 2026 | [⬇️ Tabellone-Hockey-0.9.11-installazione.exe](https://github.com/AEBWP/tabellone-hockey/releases/download/v0.9.11/Tabellone-Hockey-0.9.11-installazione.exe) |
| 0.9.10 (beta)       | 7 nov 2026 | [⬇️ Tabellone-Hockey-0.9.10-installazione.exe](https://github.com/AEBWP/tabellone-hockey/releases/download/v0.9.10/Tabellone-Hockey-0.9.10-installazione.exe) |
| 0.9.9 (beta)        | 6 nov 2026 | [⬇️ Tabellone-Hockey-0.9.9-installazione.exe](https://github.com/AEBWP/tabellone-hockey/releases/download/v0.9.9/Tabellone-Hockey-0.9.9-installazione.exe)    |
| 0.9.8 (beta)        | 6 nov 2026 | [⬇️ Tabellone-Hockey-0.9.8-installazione.exe](https://github.com/AEBWP/tabellone-hockey/releases/download/v0.9.8/Tabellone-Hockey-0.9.8-installazione.exe)    |
| Versioni precedenti |            | [Tutte le versioni](https://github.com/AEBWP/tabellone-hockey/wiki/Download)                                                                                  |

Dalla 0.9.11 il programma **si aggiorna da solo**: quando esce una versione nuova compare il
pulsante **⬆ Aggiorna** nella console
([come funziona](https://github.com/AEBWP/tabellone-hockey/wiki/Aggiornamenti)). Dalle versioni
precedenti basta eseguire l'installer della versione nuova: i dati restano.

> 🛡️ Al primo avvio Windows può mostrare **"PC protetto da Windows"**: è normale, il programma
> non ha un certificato di firma a pagamento. Clicca **Ulteriori informazioni → Esegui comunque**.
> [Perché succede](https://github.com/AEBWP/tabellone-hockey/wiki/Avviso-di-Windows).

## 📖 Guida

Tutto su installazione e uso è nella **[wiki](https://github.com/AEBWP/tabellone-hockey/wiki)**:
[installazione](https://github.com/AEBWP/tabellone-hockey/wiki/Installazione),
[console](https://github.com/AEBWP/tabellone-hockey/wiki/Usare-la-console),
[stili del tabellone](https://github.com/AEBWP/tabellone-hockey/wiki/Il-tabellone-e-gli-stili),
[squadre, regolamento e audio](https://github.com/AEBWP/tabellone-hockey/wiki/Squadre-regolamento-audio-e-backup),
[streaming su internet](https://github.com/AEBWP/tabellone-hockey/wiki/Streaming),
[domande frequenti](https://github.com/AEBWP/tabellone-hockey/wiki/Domande-frequenti).
Una guida sintetica per il palaghiaccio è anche in [INSTALLAZIONE.md](INSTALLAZIONE.md).

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
npm run screenshots # immagini di tabellone e console (per wiki e release) in screenshots/
npm run perf        # misura la fluidità delle animazioni (fotogrammi lenti per stile)
npm run live:dev    # servizio dello streaming in locale (http://127.0.0.1:8787/<nome>)
npm run live:deploy # pubblica il servizio dello streaming su Cloudflare (a ogni release)
```

In sviluppo la console è su `http://localhost:5173/` (premi `F1` per la guida rapida). Il pulsante
**Apri tabellone** apre il tabellone in una nuova finestra: trascinala sul
secondo schermo e fai **doppio clic** per lo schermo intero.

Per vedere la grafica del tabellone senza la console apri
`http://localhost:5173/display.html?demo`: i tasti da `1` a `8` mostrano le
varie situazioni (penalità, ultimo minuto, timeout, intervallo, supplementare,
rigori, finale), `G` e `H` simulano un gol, `L` mostra o nasconde i loghi, `S` cambia stile (Arena, Broadcast, Ghiaccio, Retrò, Classico, Palette, Essenziale), `K` cambia lingua, `0`
mostra la presentazione prima della partita e `P` avvia il tempo per vederne la transizione.

## Programma desktop

`npm run app` avvia la versione desktop. Al primo avvio si sceglie su quale
schermo mostrare la console e su quale, o quali, il tabellone (pulsante **Mostra il
numero su ogni schermo** per riconoscerli); la scelta può essere ricordata e
cambiata in seguito dal pulsante **Schermi…** nella console.

- il tabellone si apre a schermo intero sul maxischermo, senza barra del titolo e
  senza rubare il focus alla console; si chiude solo dalla console. Se il
  maxischermo viene scollegato torna in finestra. Si può scegliere più di uno
  schermo per il tabellone: una finestra identica su ognuno
- all'avvio compare subito una finestra “Avvio in corso…”
- le sirene suonano subito, senza dover prima cliccare
- la partita è salvata anche su file (`partita.json` nella cartella dati
  dell'app, `%APPDATA%\Tabellone Hockey`)
- niente standby dello schermo mentre il programma è aperto (nella versione da
  browser e nella pagina dello streaming con il wake lock del browser)
- un solo programma aperto alla volta
- aggiornamento automatico con [electron-updater](https://www.electron.build/auto-update)
  (`electron/updater.cjs`): controlla le release di GitHub all'avvio e ogni 6 ore; con
  **Aggiorna ora** scarica l'installer (solo le parti cambiate, grazie al `.blockmap`),
  verifica lo SHA-512, installa in silenzio e riapre il programma. Ogni release deve quindi
  pubblicare **`latest.yml`, l'installer e il suo `.blockmap`**, generati da
  `npm run dist` in `release/`. Per provarlo in locale: avviare il programma installato con
  `TABELLONE_UPDATE_URL=http://127.0.0.1:8123/` (accetta solo indirizzi locali) e servire
  da lì una cartella con quei tre file

## Streaming online

Il servizio dello streaming è un Cloudflare Worker (cartella `server/`, piano gratuito) con
la pagina per gli spettatori (`src/live/`), pubblicato su
`https://live.tabellone-hockey.workers.dev`. La console invia solo i dati della partita;
la pagina ridisegna il tabellone con lo stesso stile. Ogni palaghiaccio registra un nome (la
parte finale del link) e riceve una chiave segreta salvata sul suo PC.

⚠️ Il servizio si aggiorna a ogni release, ma nei palaghiacci restano console più vecchie: il
protocollo (`src/shared/live.ts`) può solo crescere, con valori predefiniti per tutto ciò che
manca o non si conosce.

## Struttura

```
index.html          pagina della console operatore
display.html        pagina del tabellone spettatori
src/
  engine/           motore di gioco: sola logica, coperto da test
  shared/           comunicazione tra console e tabellone
  i18n/             lingue: scritte del tabellone (board.ts) e della console (console.ts)
  console/          interfaccia della console operatore
  display/          finestra del tabellone spettatori (e demo)
  scoreboard/       grafica del tabellone spettatori: arena/, broadcast/, ghiaccio/, retro/, classico/, palette/ ed essenziale/ (stili), Matchup (presentazione “A VS B”)
  styles/           stili comuni
  setup/            scelta degli schermi all'avvio (programma desktop)
  live/             pagina per gli spettatori dello streaming su internet
server/             servizio online dello streaming (Cloudflare Worker)
electron/           processo principale del programma desktop
public/             file statici (icona, identificazione schermi)
scripts/            strumenti di sviluppo (collaudo automatico, icone, screenshot)
```
