# Tabellone Hockey – Installazione e uso al palaghiaccio

## Cosa serve

- Un PC con **Windows 10 o 11** (64 bit).
- Il **maxischermo collegato come secondo schermo** (in Windows: tasto `Windows` + `P` →
  **Estendi**).
- Facoltativo: l'uscita audio del PC collegata all'impianto del palazzetto.
- **Non serve internet**, né prima né durante la partita.

## Il file di installazione

Il programma si installa con `Tabellone-Hockey-<versione>-installazione.exe`. Non servono i
permessi di amministratore e non serve internet.

Il file si scarica dalla pagina **Releases** del progetto su GitHub (sezione **Assets** in fondo
alla pagina), oppure si crea con `npm run dist` (vedi più sotto).

## Installazione

1. Copia `Tabellone-Hockey-<versione>-installazione.exe` sul PC del palaghiaccio (chiavetta,
   rete…).
2. Doppio clic sul file.
3. **Avviso di Windows "Windows ha protetto il PC"**: clicca **Ulteriori informazioni** →
   **Esegui comunque** (vedi sotto perché compare).
4. Segui le schermate: puoi lasciare tutto com'è.
5. Al termine trovi **Tabellone Hockey** sul desktop e nel menu Start.

All'avvio compare subito una piccola finestra **“Avvio in corso…”**; dopo pochi secondi si apre il
programma.

## L'avviso “Windows ha protetto il PC”

Windows lo mostra per i programmi scaricati da internet che **non hanno una firma digitale**
riconosciuta. Non significa che il programma sia pericoloso: Windows semplicemente non sa chi
l'ha fatto.

- **Basta confermare una volta per file**: dopo “Esegui comunque”, quel file non chiede più nulla.
- **Copiandolo da una chiavetta** (invece di scaricarlo sul PC del palaghiaccio) di solito
  l'avviso non compare.
- In alternativa: tasto destro sul file → **Proprietà** → spunta **Annulla blocco** in basso →
  **OK**, prima di aprirlo.
- La prima apertura può essere più lenta: Windows Defender controlla il programma. Le volte
  successive è più veloce.

Per eliminare l'avviso del tutto servirebbe un certificato di firma digitale (a pagamento, con
verifica dell'identità).

## Scelta degli schermi

1. Collega e accendi il maxischermo **prima** di aprire il programma.
2. Apri **Tabellone Hockey**: la prima volta compare la scelta degli schermi.
3. Premi **Mostra il numero su ogni schermo** per vedere quale è quale.
4. Scegli lo schermo della **Console** (quello del PC) e quello del **Tabellone** (il
   maxischermo).
5. Lascia la spunta **Ricorda la scelta** e premi **Avvia il tabellone**.

Sul maxischermo il tabellone va **a schermo intero, senza barra del titolo** e sopra a tutto (anche
alla barra delle applicazioni di Windows). **Si chiude solo dalla console**: pulsante **Chiudi
tabellone**, oppure chiudendo il programma. Alt+F4 sul maxischermo non ha effetto.

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

Esegui il nuovo file di installazione: sostituisce la versione precedente mantenendo partita,
squadre e impostazioni.

## Problemi frequenti

| Problema                                          | Soluzione                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Il tabellone compare sul PC e non sul maxischermo | Pulsante **Schermi…** nella console e scegli il maxischermo. Controlla che in Windows lo schermo sia in modalità **Estendi**. |
| Ho chiuso per sbaglio il tabellone                | Pulsante **Apri tabellone** nella console: riprende con punteggio e tempo giusti.                                             |
| Non si sentono le sirene                          | Scheda **Audio**: controlla volume, che l'audio non sia disattivato (🔇) e l'uscita audio scelta.                             |
| Il PC si è spento durante la partita              | Riapri il programma: la partita riparte da dov'era, con il tempo che ha continuato a scorrere se era in moto.                 |

## Per chi sviluppa: creare il file di installazione

```bash
npm install
npm run dist
```

Il file viene creato nella cartella `release/`. Per cambiare l'icona modifica
`build/icon.svg` e lancia `npm run icon`.
