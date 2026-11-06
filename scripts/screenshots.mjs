// Crea le immagini per la wiki e le note delle release: tabellone in tutti gli
// stili e situazioni, console e sue schede. Avvia da solo il server di sviluppo.
//
// Uso: npm run screenshots -- <cartella di destinazione>   (predefinita: screenshots/)
import { app, BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

const root = path.join(import.meta.dirname, '..')
const outArg = process.argv.slice(2).find((a) => !a.startsWith('-') && !a.endsWith('.mjs'))
const outDir = path.resolve(outArg ?? path.join(root, 'screenshots'))
mkdirSync(outDir, { recursive: true })

const STYLES = ['arena', 'broadcast', 'ghiaccio', 'retro', 'classico']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

app.commandLine.appendSwitch('force-device-scale-factor', '1')

// Streaming: un nome d'esempio registrato solo per il tempo delle foto.
const LIVE = 'https://live.tabellone-hockey.workers.dev'
const LIVE_NAME = 'palaghiaccio-esempio'

app.whenReady().then(async () => {
  const server = await createServer({ root, logLevel: 'error', server: { port: 5199 } })
  await server.listen()
  const base = 'http://localhost:5199'

  const win = new BrowserWindow({
    show: false,
    width: 1920,
    height: 1080,
    useContentSize: true,
    webPreferences: { backgroundThrottling: false, offscreen: true },
  })
  win.webContents.setFrameRate(30)
  const js = (code) => win.webContents.executeJavaScript(code)
  const key = (k) =>
    js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)} }))`)

  async function snap(name) {
    await sleep(150)
    const image = await win.webContents.capturePage()
    writeFileSync(path.join(outDir, `${name}.png`), image.toPNG())
    console.log(`  ${name}.png`)
  }

  async function open(url, wait = 1500) {
    await win.loadURL(base + url)
    await js('document.fonts.ready.then(() => true)')
    // Niente aiuti della demo né avviso audio del browser (il programma installato non lo mostra)
    await js(
      `document.head.insertAdjacentHTML('beforeend', '<style>.demo-help,.audio-locked{display:none!important}</style>')`,
    )
    await sleep(wait)
  }

  // ── Tabellone (demo) ────────────────────────────────────────────────
  // SOLO=console oppure SOLO=tabellone per rifare solo una parte
  const only = process.env.SOLO
  win.setContentSize(1920, 1080)
  for (const [i, style] of (only === 'console' ? [] : STYLES).entries()) {
    await open('/display.html?demo')
    for (let s = 0; s < i; s++) await key('s')
    await key('0')
    await sleep(1800)
    await snap(`tabellone-${style}-presentazione`)
    await key('1')
    await sleep(1200)
    await snap(`tabellone-${style}`)
    await key('g')
    await sleep(1600)
    await snap(`tabellone-${style}-gol`)
    if (style === 'arena') {
      const scenes = {
        2: 'superiorita',
        3: 'ultimo-minuto',
        4: 'timeout',
        5: 'intervallo',
        6: 'supplementare',
        7: 'rigori',
        8: 'finale',
      }
      for (const [k, name] of Object.entries(scenes)) {
        await key(k)
        await sleep(1200)
        await snap(`tabellone-arena-${name}`)
      }
      // Le altre lingue del tabellone (tasto K della demo: it → en → de → es → fr)
      await key('1')
      for (const lang of ['en', 'de', 'es', 'fr']) {
        await key('k')
        await sleep(1200)
        await snap(`tabellone-arena-${lang}`)
      }
    }
  }

  // ── Console ─────────────────────────────────────────────────────────
  if (only === 'tabellone') return finish()
  win.setContentSize(1600, 1000)
  await open('/')
  await js('localStorage.clear()')
  await open('/')
  await snap('console-prepartita')

  // Partita in corso: la scena "gioco con penalità" della demo
  await js(`(async () => {
    const { DEMO_SCENES } = await import('/src/display/demo.ts')
    const { saveGame } = await import('/src/shared/persist.ts')
    const now = performance.timeOrigin + performance.now()
    saveGame(DEMO_SCENES[1].build(now))
  })()`)
  await open('/')
  await snap('console-partita')

  const clickTab = (label) =>
    js(
      `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})?.click()`,
    )
  for (const [label, name] of [
    ['Squadre', 'squadre'],
    ['Stile', 'stile'],
    ['Regolamento', 'regolamento'],
    ['Audio', 'audio'],
    ['Backup', 'backup'],
  ]) {
    await clickTab(label)
    await sleep(700)
    await snap(`console-${name}`)
  }
  await clickTab('Partita')
  await sleep(300)
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', code: 'F1' }))`)
  await sleep(600)
  await snap('console-guida')
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', code: 'F1' }))`)

  // Console in un'altra lingua (la lingua della console è separata da quella del tabellone)
  await js(`localStorage.setItem('tabellone-hockey:lingua-console', 'en')`)
  await open('/')
  await snap('console-inglese')
  await js(`localStorage.removeItem('tabellone-hockey:lingua-console')`)

  // Streaming: scheda della console, pagina vista dal telefono e schermata
  // d'attesa. Il nome d'esempio viene poi liberato. Senza internet si salta.
  try {
    await streamingShots()
  } catch (e) {
    console.log(`  (streaming saltato: ${e.message})`)
  }

  async function streamingShots() {
    const claim = await fetch(`${LIVE}/api/channels/${LIVE_NAME}/claim`, { method: 'POST' })
    if (!claim.ok) throw new Error(`nome d'esempio non disponibile (${claim.status})`)
    const { key: secret } = await claim.json()
    const settings = { service: LIVE, name: LIVE_NAME, key: secret, qrLogo: null }
    try {
      await js(
        `localStorage.setItem('tabellone-hockey:streaming', ${JSON.stringify(JSON.stringify(settings))})`,
      )
      await open('/')
      await clickTab('Streaming')
      await sleep(500)
      await clickTab('Avvia streaming')
      await sleep(6000)
      await snap('console-streaming')

      // Il pubblico, in un'altra finestra (la console deve restare aperta).
      const viewer = new BrowserWindow({
        show: false,
        width: 390,
        height: 844,
        useContentSize: true,
        webPreferences: { backgroundThrottling: false, offscreen: true },
      })
      const snapViewer = async (name) => {
        await sleep(150)
        writeFileSync(
          path.join(outDir, `${name}.png`),
          (await viewer.webContents.capturePage()).toPNG(),
        )
        console.log(`  ${name}.png`)
      }
      await viewer.loadURL(`${LIVE}/${LIVE_NAME}`)
      await sleep(4000)
      await snapViewer('streaming-telefono')

      // Streaming fermo: chi apre il link vede la schermata d'attesa.
      await clickTab('Ferma streaming')
      await sleep(1500)
      viewer.setContentSize(1280, 720)
      await viewer.loadURL(`${LIVE}/${LIVE_NAME}`)
      await sleep(3000)
      await snapViewer('streaming-attesa')
      viewer.destroy()
    } finally {
      await fetch(`${LIVE}/api/channels/${LIVE_NAME}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${secret}` },
      })
      await open('/')
      await js(`localStorage.removeItem('tabellone-hockey:streaming')`)
    }
  }

  await server.close()
  console.log(`\nImmagini in ${outDir}`)
  app.quit()
})
