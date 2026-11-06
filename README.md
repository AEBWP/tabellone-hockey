# Tabellone Hockey

![Versione](https://img.shields.io/github/v/release/AEBWP/tabellone-hockey?label=versione&color=1f6feb)
![Stato: beta](https://img.shields.io/badge/stato-beta-orange)
![Windows 10 e 11](https://img.shields.io/badge/Windows-10%20%7C%2011-0078d4)
![Offline](https://img.shields.io/badge/funziona-offline-2ea043)

Tabellone segnapunti per hockey su ghiaccio, pensato per il palaghiaccio:
una **console operatore** sul PC e un **tabellone spettatori** a schermo intero
sul maxischermo. Funziona completamente **offline**; se c'è internet, la partita si può
anche seguire **in streaming** dal telefono, con un link e un QR code fissi per il palaghiaccio.

![Il tabellone sul maxischermo (stile Arena)](https://raw.githubusercontent.com/wiki/AEBWP/tabellone-hockey/images/tabellone-arena.png)

> 🧪 **Il progetto è in beta** (versioni 0.9.x): funziona ed è usabile, ma non è ancora arrivato
> alla **versione 1.0**, prevista dopo le prove sul campo al palaghiaccio.

## ⬇️ Scarica

### [👉 Scarica il Tabellone Hockey per Windows (ultima versione)](https://github.com/AEBWP/tabellone-hockey/releases/latest)

| Versione                 | Data       | Download                                                                                                                                                   |
| ------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0.9.7** (ultima, beta) | 6 nov 2026 | [⬇️ Tabellone-Hockey-0.9.7-installazione.exe](https://github.com/AEBWP/tabellone-hockey/releases/download/v0.9.7/Tabellone-Hockey-0.9.7-installazione.exe) |
| 0.9.6 (beta)             | 5 nov 2026 | [⬇️ Tabellone-Hockey-0.9.6-installazione.exe](https://github.com/AEBWP/tabellone-hockey/releases/download/v0.9.6/Tabellone-Hockey-0.9.6-installazione.exe) |
| Versioni precedenti      |            | [Tutte le versioni](https://github.com/AEBWP/tabellone-hockey/wiki/Download)                                                                               |

Per aggiornare basta eseguire l'installer della versione nuova: i dati restano.

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
rigori, finale), `G` e `H` simulano un gol, `L` mostra o nasconde i loghi, `S` cambia stile (Arena, Broadcast, Ghiaccio, Retrò, Classico), `K` cambia lingua, `0`
mostra la presentazione prima della partita e `P` avvia il tempo per vederne la transizione.

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
  scoreboard/       grafica del tabellone spettatori: arena/, broadcast/, ghiaccio/, retro/ e classico/ (stili), Matchup (presentazione “A VS B”)
  styles/           stili comuni
  setup/            scelta degli schermi all'avvio (programma desktop)
  live/             pagina per gli spettatori dello streaming su internet
server/             servizio online dello streaming (Cloudflare Worker)
electron/           processo principale del programma desktop
public/             file statici (icona, identificazione schermi)
scripts/            strumenti di sviluppo (collaudo automatico, icone, screenshot)
```
