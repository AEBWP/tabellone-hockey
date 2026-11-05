// Collega questo PC a Dropbox per caricare le release (da fare una volta sola).
// Uso: npm run dropbox:collega
//
// Prima crea un'app su https://www.dropbox.com/developers/apps (vedi
// INSTALLAZIONE.md, sezione "Copia delle release su Dropbox").
import { createHash, randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { CONFIG_FILE, connect, tokenRequest, writeConfig } from './dropbox-lib.mjs'

// Errori (rete, accesso negato…): messaggio chiaro invece dello stack tecnico.
process.on('uncaughtException', (e) => {
  console.error(`\n✖ ${e.message}`)
  process.exit(1)
})

const rl = createInterface({ input: process.stdin, output: process.stdout })

console.log('\nCollegamento a Dropbox per le release del Tabellone Hockey\n')
const appKey = (await rl.question('1) Incolla la "App key" della tua app Dropbox: ')).trim()
if (!appKey) {
  console.error('Nessuna App key: operazione annullata.')
  process.exit(1)
}

// Accesso PKCE: non serve il "segreto" dell'app.
const verifier = randomBytes(48).toString('base64url')
const challenge = createHash('sha256').update(verifier).digest('base64url')
const url = new URL('https://www.dropbox.com/oauth2/authorize')
url.search = new URLSearchParams({
  client_id: appKey,
  response_type: 'code',
  code_challenge: challenge,
  code_challenge_method: 'S256',
  token_access_type: 'offline',
}).toString()

console.log('\n2) Apri questo indirizzo nel browser, accedi a Dropbox e premi "Consenti":\n')
console.log(`   ${url}\n`)
const code = (await rl.question('3) Incolla qui il codice che Dropbox ti mostra: ')).trim()
rl.close()

const tokens = await tokenRequest({
  grant_type: 'authorization_code',
  code,
  code_verifier: verifier,
  client_id: appKey,
})
if (!tokens.refresh_token) throw new Error('Dropbox non ha restituito un token di rinnovo.')

const cfg = { appKey, refreshToken: tokens.refresh_token }
const dbx = await connect(cfg)
const account = await dbx.rpc('users/get_current_account', null)
writeConfig(cfg)

console.log(`\nFatto: collegato all'account Dropbox di ${account.name.display_name}.`)
console.log(`Credenziali salvate in ${CONFIG_FILE} (non condividere questo file).`)
