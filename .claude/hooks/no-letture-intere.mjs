// Impedisce di leggere per intero src/i18n/console.ts (136 KB, circa 40.000 token).
// Le letture a pezzi e le ricerche restano permesse: il file si deve poter modificare.
const MAX_RIGHE = 300

let testo = ''
for await (const pezzo of process.stdin) testo += pezzo

const input = JSON.parse(testo).tool_input ?? {}
const percorso = String(input.file_path ?? '').replaceAll('\\', '/')

if (/(^|\/)src\/i18n\/console\.ts$/.test(percorso) && !(input.limit <= MAX_RIGHE)) {
  console.error(
    `src/i18n/console.ts è troppo grande per leggerlo tutto. Cerca la frase con Grep, oppure leggi al massimo ${MAX_RIGHE} righe con offset e limit. Per aggiungere una traduzione basta leggere la fine di ROWS (cerca "CONSOLE_TEXT").`,
  )
  process.exit(2)
}
