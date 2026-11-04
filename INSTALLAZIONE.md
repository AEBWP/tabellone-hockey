# Tabellone Hockey – Installazione e uso al palaghiaccio

## Cosa serve

- Un PC con **Windows 10 o 11** (64 bit).
- Il **maxischermo collegato come secondo schermo** (in Windows: tasto `Windows` + `P` →
  **Estendi**).
- Facoltativo: l'uscita audio del PC collegata all'impianto del palazzetto.
- **Non serve internet**, né prima né durante la partita.

## Due versioni, scegline una

| File                                            | Quando usarlo                                                                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tabellone Hockey-<versione>-installazione.exe` | **Consigliato.** Installa il programma con collegamento sul desktop e nel menu Start. Non servono i permessi di amministratore.                                       |
| `Tabellone Hockey-<versione>-portable.exe`      | Un unico file da tenere su una chiavetta USB o in una cartella: si avvia con doppio clic, senza installare niente. Utile per provare o se l'installazione è bloccata. |

I file si trovano nella cartella `release/` dopo aver eseguito `npm run dist`
(vedi più sotto).

## Installazione

1. Copia `Tabellone Hockey-<versione>-installazione.exe` sul PC del palaghiaccio (chiavetta,
   rete…).
2. Doppio clic sul file.
3. **Avviso di Windows "Windows ha protetto il PC"**: compare perché il programma non è firmato
   digitalmente (la firma costa alcune centinaia di euro l'anno). Clicca **Ulteriori
   informazioni** → **Esegui comunque**.
4. Segui le schermate: puoi lasciare tutto com'è.
5. Al termine trovi **Tabellone Hockey** sul desktop e nel menu Start.

## Primo avvio

1. Collega e accendi il maxischermo **prima** di aprire il programma.
2. Apri **Tabellone Hockey**: compare la scelta degli schermi.
3. Premi **Mostra il numero su ogni schermo** per vedere quale è quale.
4. Scegli lo schermo della **Console** (quello del PC) e quello del **Tabellone** (il
   maxischermo).
5. Lascia la spunta **Ricorda la scelta** e premi **Avvia il tabellone**.

Dalla volta successiva il programma parte direttamente. Per cambiare: pulsante **Schermi…**
nella console.

## Prima della partita

- Scheda **Squadre**: scegli le squadre dall'archivio (o creale con nome, sigla, colore e logo).
- Scheda **Regolamento** o **Nuova partita…**: scegli il regolamento giusto (Senior, Giovanili…).
- Scheda **Audio**: premi **▶ Prova** per controllare che le sirene escano dalle casse giuste.
- Premi `F1` per la guida rapida con tutte le scorciatoie.

## Portare squadre e regolamenti da un altro PC

Sul PC dove li hai preparati: scheda **Backup** → **Scarica file di backup**. Copia il file
sul PC del palaghiaccio, poi scheda **Backup** → **Scegli file di backup…**.

## Dove sono salvati i dati

Nella cartella `%APPDATA%\tabellone-hockey` (incollala nella barra degli indirizzi di Esplora
file):

- `partita.json` – la partita in corso (salvata a ogni azione);
- `config.json` – gli schermi scelti.

Squadre, loghi, regolamenti e impostazioni audio sono salvati nella stessa cartella. Disinstallando
il programma i dati **non** vengono cancellati.

## Aggiornare

Esegui il nuovo file di installazione: sostituisce la versione precedente mantenendo tutti i dati.

## Problemi frequenti

| Problema                                          | Soluzione                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Il tabellone compare sul PC e non sul maxischermo | Pulsante **Schermi…** nella console e scegli il maxischermo. Controlla che in Windows lo schermo sia in modalità **Estendi**. |
| Ho chiuso per sbaglio il tabellone                | Pulsante **Apri tabellone** nella console: riprende con punteggio e tempo giusti.                                             |
| Non si sentono le sirene                          | Scheda **Audio**: controlla volume, che l'audio non sia disattivato (🔇) e l'uscita audio scelta.                             |
| Il PC si è spento durante la partita              | Riapri il programma: la partita riparte da dov'era, con il tempo che ha continuato a scorrere se era in moto.                 |

## Per chi sviluppa: creare i file di installazione

```bash
npm install
npm run dist
```

I file vengono creati nella cartella `release/`. Per cambiare l'icona modifica
`build/icon.svg` e lancia `npm run icon`.
