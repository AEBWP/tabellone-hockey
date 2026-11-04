# Tabellone Hockey — Piano di progetto

Sistema segnapunti per hockey su ghiaccio, pensato per il palaghiaccio:
un PC con il maxischermo collegato come schermo esteso.

## Obiettivi

- **Funziona offline al 100%**: nessuna dipendenza da internet (font, loghi, suoni inclusi).
- **Due pannelli**: la _console operatore_ sul monitor del PC e il _tabellone spettatori_ a schermo intero sul maxischermo.
- **Distribuzione semplice**: un installer `.exe` per Windows (più una versione portable).
- **Grafica curata** per il pubblico, **console chiara e veloce** per l'operatore.
- **Robusto**: se il programma o il PC si riavvia, la partita riprende da dove era.

## Scelte tecniche

| Tema                              | Scelta                                                                        | Perché                                                               |
| --------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Interfaccia                       | HTML + CSS + TypeScript, build con **Vite**                                   | grafica libera, codice tipizzato, build in file statici              |
| Framework UI                      | **Svelte** (leggero)                                                          | la console ha molto stato; Svelte resta semplice e veloce            |
| App desktop                       | **Electron** + **electron-builder**                                           | stesso codice web, finestre multiple, scelta schermi, installer NSIS |
| Comunicazione console → tabellone | `BroadcastChannel` in fase web, IPC in Electron (dietro un'unica interfaccia) | il codice dei pannelli non cambia passando a Electron                |
| Salvataggio stato                 | `localStorage` in fase web, file JSON su disco in Electron                    | ripresa dopo crash/riavvio                                           |
| Test                              | **Vitest** sul motore di gioco                                                | le regole (penalità, tempo) devono essere affidabili                 |

### Principi

- **Un solo "motore di gioco"** in logica pura (niente grafica): tempo, periodi, punteggio, penalità.
  Console e tabellone si limitano a _leggere_ lo stato e a _mandare comandi_.
- **Tempo calcolato da timestamp**, non "un secondo alla volta": niente ritardi accumulati, console e tabellone sempre allineati al decimo.
- **Tabellone in 16:9 scalabile**: disegnato su 1920×1080 e adattato a qualsiasi risoluzione. Se il maxischermo ha un formato diverso, si aggiunge un layout dedicato.

## Regole configurabili

Menu a tendina con **preset** modificabili, più **"Personalizzato"**. Ogni preset è solo un insieme di valori: si può partire da uno e cambiarlo, e salvare i propri.

Preset iniziali (valori da confermare con chi usa il palaghiaccio):

| Preset                | Periodi       | Durata        | Intervallo    | Supplementare           | Rigori         |
| --------------------- | ------------- | ------------- | ------------- | ----------------------- | -------------- |
| Senior (regole IIHF)  | 3             | 20'           | 15'           | 5' (morte improvvisa)   | sì, 3 tiratori |
| Senior playoff        | 3             | 20'           | 15'           | 20' ripetuti            | no             |
| Giovanili             | 3             | 15'           | 10'           | nessuno / configurabile | configurabile  |
| Amatori / allenamento | configurabile | configurabile | configurabile | configurabile           | configurabile  |

Parametri configurabili:

- numero e durata dei periodi, durata intervallo
- supplementare (sì/no, durata, morte improvvisa)
- rigori (sì/no, numero di tiratori)
- **tempo effettivo** (si ferma a ogni fischio) oppure **tempo continuo**
- durate penalità: minore (default 2'), doppia minore, maggiore (5'), cattiva condotta (10')
- durata timeout (default 30")
- decimi di secondo nell'ultimo minuto (sì/no)

### Penalità (la parte più delicata)

- Ogni penalità ha squadra, numero del giocatore, tipo e countdown.
- Il countdown scorre **solo quando scorre il tempo di gioco**.
- Al massimo **2 giocatori in meno** per squadra: le penalità in più restano in coda e partono quando se ne libera una.
- **Minore**: termina in anticipo se la squadra avversaria segna in superiorità. **Doppia minore**: termina solo la parte in corso.
- **Cattiva condotta (10')**: il giocatore esce, ma la squadra non resta in inferiorità.
- L'operatore può sempre correggere a mano (eliminare, modificare, chiudere in anticipo).

## Funzionalità

### Tabellone spettatori

- Nomi squadre, colori e loghi
- Punteggio grande e leggibile da lontano
- Tempo di gioco e periodo (1°, 2°, 3°, OT, rigori), decimi nell'ultimo minuto
- Penalità in corso per squadra (numero giocatore + countdown)
- Tiri in porta (opzionale)
- Schermate speciali: animazione **GOAL**, timeout, intervallo con countdown, rigori, fine partita

### Console operatore

- Controlli grandi e chiari, con **scorciatoie da tastiera** (es. `Spazio` avvia/ferma il tempo)
- Tutti i dati della partita (tempo, punteggi, penalità) mostrati direttamente nei pannelli della console, senza anteprima del maxischermo (occupava spazio e ripeteva gli stessi dati)
- Pulsanti **"?"** accanto alle funzioni principali, con una breve spiegazione
- Schermata di aiuto con tutte le scorciatoie (`F1`)
- Correzioni rapide: modifica punteggio, tempo, periodo
- Conferma per le azioni distruttive (es. "Nuova partita")
- Registro eventi della partita (gol, penalità) con possibilità di annullare l'ultima azione

### Audio

- Sirena di fine periodo, sirena gol, suono timeout
- Volume regolabile e tasto silenzio
- Suoni generati o con licenza libera, inclusi nel programma
- In Electron: scelta dell'uscita audio (es. HDMI del maxischermo o impianto del palazzetto)

## Fasi di lavoro

1. **Base del progetto**: Vite + TypeScript + Svelte, struttura cartelle, test, lint.
2. **Motore di gioco**: tempo, periodi, punteggio, penalità, regole configurabili. Coperto da test.
3. **Tabellone spettatori**: grafica 16:9 scalabile, animazioni (gol, intervallo, fine partita).
4. **Console operatore**: controlli, scorciatoie, aiuti "?".
   → _A questo punto si può provare tutto nel browser con due schede._
5. **Configurazione**: preset di regole, squadre (nomi, colori, loghi), salvataggio impostazioni.
6. **Audio**: sirene, volume.
7. **Electron**:
   - **schermata di avvio con la scelta degli schermi**: mostra tutti gli schermi collegati (con il loro numero visualizzato su ciascuno) e si indica quale ospita la console e quale il tabellone. La scelta viene ricordata per le volte successive;
   - apertura automatica delle due finestre, tabellone a schermo intero;
   - salvataggio della partita su disco e ripresa dopo crash o riavvio;
   - blocco dello standby del PC durante la partita.
8. **Installer**: `.exe` di installazione (NSIS), icona, collegamento sul desktop, versione portable.
9. **Prova al palaghiaccio**: verifica risoluzione reale, audio, leggibilità da lontano; ritocchi.

### Idee per dopo

- Sponsor a rotazione durante le pause
- Archivio partite e statistiche
- Libreria squadre con loghi salvati
- Formazioni e marcatori
- Telecomando da telefono (in rete locale, sempre senza internet)

## Da verificare al palaghiaccio

- Risoluzione e formato reali del maxischermo
- Versione di Windows e permessi di installazione
- Collegamento audio (uscita del PC verso l'impianto)
- Regole effettivamente usate per le varie categorie
