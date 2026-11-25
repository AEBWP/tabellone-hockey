# Tabellone Hockey

Segnapunti per hockey su ghiaccio usato in partite vere: console operatore sul PC, tabellone sul maxischermo, streaming facoltativo su internet. Funziona al 100% offline. Stabile dalla 1.0.0. Repo pubblico `AEBWP/tabellone-hockey`. Si parla in italiano, anche nei commenti e nei commit (`1.0.4: descrizione` per le release, frase semplice negli altri).

Svelte 5 (runes), TypeScript 6, Vite 8, Vitest 5, Electron 45 con electron-builder ed electron-updater, Cloudflare Worker con Durable Object per lo streaming. Lingue: it, en, de, es, fr.

## Regole che vincono su tutto

1. **Il regolamento ufficiale (IIHF, o quello del preset) viene prima di ogni richiesta**, anche dell'utente. Se una richiesta su tempo, periodi, gol, penalità, timeout, supplementare, rigori o correzioni lo viola, fermati e dillo chiaramente prima di farla: regola, conseguenza, alternativa conforme.
2. **Lo streaming resta compatibile con le console vecchie.** Il sito si aggiorna a ogni release, le console nei palaghiacci no. `src/shared/live.ts` e `server/` possono solo crescere: campi nuovi facoltativi, niente rinomine o rimozioni, valori predefiniti per ciò che manca. Se non si può, fermati e chiedi all'utente.
3. **Le partite salvate di versioni vecchie devono ripartire.** I campi nuovi di `GameState` e `Rules` vanno completati da `migrate()` in `src/shared/persist.ts`.
4. **Niente dipendenze da internet** per font, loghi e suoni.

## Non leggere questi file

- `package-lock.json`, `node_modules/`, `dist/`, `release*/`, `server/public/`: lettura bloccata. Le versioni delle dipendenze si trovano con `npm ls <nome>`.
- `src/i18n/console.ts` (136 KB, circa 40.000 token): lettura intera bloccata, si cerca con Grep o si legge a pezzi. Contiene solo `ROWS`, righe `[it, en, de, es, fr]`, e in fondo le mappe `CONSOLE_TEXT`.
- Da aprire solo se servono davvero, a pezzi: `src/console/Console.svelte` (41 KB), `electron/main.cjs` (34 KB).

## Comandi

```bash
npm test                    # 194 test, circa 7 secondi
npm run check               # tipi TypeScript e Svelte
npm run format              # prettier
npm run dev                 # console su localhost:5173, tabellone su /display.html?demo
npm run app                 # programma desktop
npm run app:smoke           # collaudo automatico del programma desktop
npm run screenshots         # immagini per wiki e release (SOLO=console|tabellone|setup)
npm run perf                # fluidità delle animazioni per stile
npm run dist                # installer in release/
npm run live:dev            # streaming in locale
npm run live:deploy         # pubblica lo streaming su Cloudflare
```

In `display.html?demo`: `1`-`8` situazioni, `G`/`H` gol, `L` loghi, `S` stile, `K` lingua, `0` presentazione, `P` avvia il tempo. Anteprima in Claude: configurazione `dev` in `.claude/launch.json`.

## Come è fatto

Un solo stato (`GameState`), logica pura, le finestre leggono e basta.

- **Motore, `src/engine/`** (nessuna grafica, coperto da test): `apply(state, command, now)` applica un `Command` (elenco in `game.ts`), `isAllowed` dice quando è permesso, `advance(state, now)` fa scorrere il tempo, `deriveView(state, now)` in `view.ts` produce la `GameView` che disegnano le finestre. Tipi in `types.ts`, preset e limiti in `rules.ts`, penalità in `penalties.ts`.
- **Tempo da timestamp, mai a passi.** `GameClock` tiene il tempo di gioco assoluto. Le penalità hanno `startMs` ed `endMs` nello stesso riferimento, così scorrono solo a tempo in moto.
- **Console → tabellone**: `src/console/Console.svelte` tiene lo stato e lo invia con `BroadcastChannel` (`src/shared/channel.ts`, messaggi in `messages.ts`) solo quando cambia; il tabellone calcola da sé il tempo che scorre. Vale anche in Electron: `PIANO.md` parla di IPC ma non è più così.
- **Salvataggio**: `localStorage` più `partita.json` in `%APPDATA%\Tabellone Hockey` su desktop. Squadre e regolamenti in `src/shared/library.ts`.
- **Tabellone**: `src/scoreboard/Scoreboard.svelte` sceglie lo stile; ogni stile è una cartella disegnata su 1920×1080 con `Scoreboard.svelte` e `GoalOverlay.svelte`. Stili: arena, broadcast, ghiaccio, retro, classico, palette, essenziale, led.
- **Electron**: `electron/main.cjs` (finestre, IPC), `preload.cjs`, `screens.cjs`, `updater.cjs`. Lato web si passa da `src/shared/desktop.ts`.
- **Streaming**: la console (`src/console/streaming.svelte.ts`) invia lo stato senza loghi al Worker `server/src/index.ts` (Durable Object `Channel`, rotte `/api/channels/<nome>/...`), la pagina `src/live/` ridisegna il tabellone. Servizio: `https://live.tabellone-hockey.workers.dev`.

## Ricette

- **Testo in console**: scrivi `t('Frase italiana')` e aggiungi una riga alla fine di `ROWS` in `src/i18n/console.ts` con tutte e cinque le lingue, usando i termini dell'hockey di ogni paese e lasciando intatti i `{segnaposto}`. `npm test` fallisce se manca una traduzione.
- **Scritta sul tabellone**: `src/i18n/board.ts`, in tutte le lingue.
- **Nuova regola**: `Rules` e preset in `rules.ts`, limiti e `validateRules`, `RulesTab.svelte`. I messaggi di errore vanno tradotti.
- **Nuovo comando di gioco**: `Command` e `apply` in `game.ts`, `isAllowed`, test in `src/engine/`.
- **Nuovo stile**: `BoardStyle` e `BOARD_STYLES` in `types.ts`, `styles.ts` (nome e descrizione, tradotti in `console.ts`), `Scoreboard.svelte`, `Warmup.svelte`, `Matchup.svelte`, `scripts/screenshots.mjs`, cartella in `src/scoreboard/`.
- **Campo nuovo nello stato**: valore predefinito in `createGame`, controlla `migrate()` e la pagina `src/live/`, che riceve anche console vecchie.

## Release

Solo su richiesta dell'utente, sempre versioni definitive: mai prerelease o bozze dimenticate, mai Dropbox.

1. Versione in `package.json`, `npm test`, `npm run check`.
2. `npm run live:deploy` **prima** di pubblicare (serve `npx wrangler login` già fatto).
3. Se la grafica è cambiata, `npm run screenshots` e immagini nella wiki (`images/`). Prima controlla che la porta 5199 sia libera: un processo rimasto mostra una versione vecchia.
4. `npm run dist`, poi `SHA256SUMS.txt` con `sha256sum -b` in `release/`.
5. `gh release create` con **`latest.yml`, l'installer `.exe` e il suo `.exe.blockmap`**, altrimenti i programmi installati non si aggiornano.
6. Note di release: screenshot in cima, breve stato, link alla pagina wiki `Avviso-di-Windows`.
7. Nuova riga nella tabella download del `README.md` e nella pagina wiki `Download` (git `tabellone-hockey.wiki.git`, fine riga CRLF).

Dettagli:

- **Wiki**: immagini in `images/`, citate con `https://raw.githubusercontent.com/wiki/AEBWP/tabellone-hockey/images/...`. Le pagine sono CRLF: normalizzare a LF prima delle sostituzioni, poi riscrivere CRLF. Nella pagina `Download` la riga più recente è segnata «Ultima».
- **Note di release**: dalla 1.0.0 il programma è stabile, niente note beta. Il link a `Avviso-di-Windows` serve a rassicurare sull'avviso SmartScreen dell'installer non firmato.
- **Screenshot**: `npm run screenshots` crea anche le immagini del primo avvio (scelta-lingua, scelta-schermi, scelta-schermi-posizione) e dello streaming, occupando per poco il nome `palaghiaccio-esempio`.
- **Chiavetta USB** (solo sul PC dell'utente, di solito `D:`): copiare l'installer senza cancellare i file vecchi, poi verificare lo SHA-256.
- **Prova dell'aggiornamento automatico in locale**: installare una build, avviarla con `TABELLONE_UPDATE_URL=http://127.0.0.1:8123/` (più `--remote-debugging-port` per pilotarla via CDP) e servire una cartella con i tre file di una build più nuova. Installazione silenziosa e riavvio richiedono circa 45 s, dati utente intatti.

## Lavorare con gli agenti

Ogni agente paga tutto ciò che legge: delega solo se costa meno che farlo direttamente. Poche ricerche e una modifica piccola si fanno senza agenti.

**Scegli il livello più basso che basta**, sempre per nome:

| Lavoro                                                      | Agente               | Modello |
| ----------------------------------------------------------- | -------------------- | ------- |
| Trovare file, chiamate, punti da toccare                    | `Explore`            | Haiku   |
| Traduzioni, testi, tabelle, rinomine, lanciare test o build | `operaio`            | Haiku   |
| Funzioni e correzioni in console, stili, audio, Electron    | `sviluppatore`       | Sonnet  |
| Motore, regolamento, protocollo streaming, architettura     | `specialista-regole` | Opus    |

Niente Opus per lavori meccanici. Se un agente più economico si ferma perché il compito è troppo difficile, si sale di un livello.

**Agente nuovo o fork.** Di norma un agente nuovo con un incarico breve: ha già questo file e può girare su un modello economico. La fork eredita tutta la conversazione e gira sempre sul modello del coordinatore, quindi usala solo se il compito dipende da ciò che il coordinatore ha già scoperto, non si riassume in poche righe, richiede comunque il suo modello e la conversazione è ancora corta.

**Parallelo.** Solo per lavori davvero indipendenti che toccano file diversi; due agenti non modificano mai lo stesso file.

**Passaggio di informazioni, mai contenuti in chat.**

- L'incarico dice: obiettivo, file di partenza, cosa significa finito. Non ripete questo file.
- Chi produce un risultato lungo lo scrive in `.claude/lavoro/<attività>/<agente>.md` (cartella ignorata da git) e risponde solo con il percorso e al massimo cinque righe.
- Per passare lavoro tra agenti si usa `SendMessage`, che recapita da solo e non richiede controlli periodici. Il messaggio contiene il percorso del file, non il contenuto, e chi lo riceve legge solo la parte che gli serve.
- Per continuare il lavoro di un agente già finito si usa `SendMessage` verso di lui invece di lanciarne uno nuovo: ha già il suo contesto.
- A lavoro finito la cartella dell'attività si cancella.
