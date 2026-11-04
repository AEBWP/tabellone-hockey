// Processo principale dell'app desktop (Electron).
//
// - All'avvio mostra la scelta degli schermi (o la salta se ricordata).
// - Apre la console sullo schermo dell'operatore e il tabellone a schermo
//   intero sul maxischermo.
// - Serve i file dell'interfaccia con il protocollo app:// (niente server,
//   niente internet).
// - Salva la partita anche su file, impedisce lo standby durante l'uso.

const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  powerSaveBlocker,
  protocol,
  screen,
} = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { defaultChoice, describeScreens, isChoiceValid } = require('./screens.cjs')

const DIST = path.join(__dirname, '..', 'dist')
// In sviluppo si può puntare al server di Vite: TABELLONE_DEV_URL=http://localhost:5173/
const BASE_URL = process.env.TABELLONE_DEV_URL || 'app://tabellone/'
const SMOKE_TEST = process.env.TABELLONE_SMOKE_TEST // percorso cartella per il collaudo automatico

const PRELOAD = path.join(__dirname, 'preload.cjs')
const userFile = (name) => path.join(app.getPath('userData'), name)

/** @type {BrowserWindow | null} */ let consoleWin = null
/** @type {BrowserWindow | null} */ let displayWin = null
/** @type {BrowserWindow | null} */ let setupWin = null
/** @type {BrowserWindow[]} */ let identifyWins = []
/** @type {{ consoleId: number, displayId: number } | null} */ let choice = null
let quitting = false

// ── Impostazioni (schermi scelti) ─────────────────────────────────────────

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(userFile('config.json'), 'utf8'))
  } catch {
    return {}
  }
}

function writeConfig(config) {
  writeFileAtomic(userFile('config.json'), JSON.stringify(config, null, 2))
}

/** Scrittura sicura: prima un file temporaneo, poi lo scambio. Niente file a metà se il PC si spegne. */
function writeFileAtomic(file, data) {
  const tmp = `${file}.tmp`
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(tmp, data, 'utf8')
  fs.renameSync(tmp, file)
}

// ── Schermi ───────────────────────────────────────────────────────────────

function screens() {
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    bounds: d.bounds,
    primary: d.id === screen.getPrimaryDisplay().id,
    scaleFactor: d.scaleFactor,
    label: d.label || '',
  }))
}

function displayById(id) {
  return screen.getAllDisplays().find((d) => d.id === id) ?? screen.getPrimaryDisplay()
}

// ── Finestre ──────────────────────────────────────────────────────────────

function baseWebPreferences() {
  return {
    preload: PRELOAD,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    // Il tempo deve scorrere anche se la finestra non è in primo piano.
    backgroundThrottling: false,
    // Le sirene devono suonare senza aspettare un clic.
    autoplayPolicy: 'no-user-gesture-required',
  }
}

/** Blocca navigazioni e finestre esterne: l'app non apre mai pagine web. */
function lockDown(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('display.html')) openDisplay()
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(BASE_URL)) event.preventDefault()
  })
}

function openSetup() {
  if (setupWin && !setupWin.isDestroyed()) {
    setupWin.show()
    setupWin.focus()
    return
  }
  const primary = screen.getPrimaryDisplay()
  setupWin = new BrowserWindow({
    width: 980,
    height: 720,
    x: primary.workArea.x + Math.round((primary.workArea.width - 980) / 2),
    y: primary.workArea.y + Math.round((primary.workArea.height - 720) / 2),
    title: 'Tabellone Hockey – Scelta degli schermi',
    backgroundColor: '#050d18',
    show: false,
    webPreferences: baseWebPreferences(),
  })
  lockDown(setupWin)
  setupWin.once('ready-to-show', () => setupWin?.show())
  setupWin.on('closed', () => {
    setupWin = null
    closeIdentify()
    // Chiusa senza scegliere e senza console aperta: si esce.
    if (!consoleWin && !quitting) app.quit()
  })
  void setupWin.loadURL(`${BASE_URL}setup.html`)
}

function placeConsole() {
  if (!choice) return
  const d = displayById(choice.consoleId)
  if (!consoleWin || consoleWin.isDestroyed()) {
    consoleWin = new BrowserWindow({
      ...d.workArea,
      minWidth: 900,
      minHeight: 600,
      title: 'Tabellone Hockey – Console',
      backgroundColor: '#050d18',
      show: false,
      webPreferences: baseWebPreferences(),
    })
    lockDown(consoleWin)
    consoleWin.once('ready-to-show', () => {
      consoleWin?.maximize()
      consoleWin?.show()
    })
    consoleWin.on('close', (event) => {
      if (quitting || SMOKE_TEST) return
      // Chiudere la console chiude tutto: chiediamo conferma.
      const answer = dialog.showMessageBoxSync(consoleWin, {
        type: 'question',
        buttons: ['Chiudi il programma', 'Annulla'],
        defaultId: 1,
        cancelId: 1,
        title: 'Chiudere il Tabellone Hockey?',
        message: 'Chiudere il Tabellone Hockey?',
        detail: 'Anche il tabellone sul maxischermo verrà chiuso. La partita resta salvata.',
      })
      if (answer !== 0) event.preventDefault()
      else quitting = true
    })
    consoleWin.on('closed', () => {
      consoleWin = null
      app.quit()
    })
    void consoleWin.loadURL(`${BASE_URL}index.html`)
  } else {
    if (consoleWin.isMaximized()) consoleWin.unmaximize()
    consoleWin.setBounds(d.workArea)
    consoleWin.maximize()
  }
}

function placeDisplay() {
  if (!displayWin || displayWin.isDestroyed() || !choice) return
  const d = displayById(choice.displayId)
  const sameScreen = choice.displayId === choice.consoleId || d.id !== choice.displayId

  if (displayWin.isFullScreen()) displayWin.setFullScreen(false)
  if (sameScreen) {
    // Un solo schermo (es. prove a casa): finestra normale, ridimensionabile.
    const w = Math.round(d.workArea.width * 0.6)
    const h = Math.round((w * 9) / 16)
    displayWin.setBounds({
      x: d.workArea.x + Math.round((d.workArea.width - w) / 2),
      y: d.workArea.y + Math.round((d.workArea.height - h) / 2),
      width: w,
      height: h,
    })
  } else {
    displayWin.setBounds(d.bounds)
    displayWin.setFullScreen(true)
  }
}

function openDisplay() {
  if (displayWin && !displayWin.isDestroyed()) {
    placeDisplay()
    displayWin.showInactive()
    return
  }
  displayWin = new BrowserWindow({
    width: 960,
    height: 540,
    title: 'Tabellone Hockey – Maxischermo',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
    webPreferences: baseWebPreferences(),
  })
  lockDown(displayWin)
  displayWin.once('ready-to-show', () => {
    placeDisplay()
    // Senza rubare il focus alla console: l'operatore continua a usare la tastiera.
    displayWin?.showInactive()
  })
  displayWin.on('closed', () => (displayWin = null))
  void displayWin.loadURL(`${BASE_URL}display.html`)
}

function startMain(newChoice) {
  choice = newChoice
  placeConsole()
  openDisplay()
}

// ── Identificazione schermi: un grande numero su ognuno ───────────────────

function closeIdentify() {
  for (const w of identifyWins) if (!w.isDestroyed()) w.close()
  identifyWins = []
}

function identifyScreens() {
  closeIdentify()
  for (const s of describeScreens(screens())) {
    const d = displayById(s.id)
    const win = new BrowserWindow({
      ...d.bounds,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: true,
      resizable: false,
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true },
    })
    win.setIgnoreMouseEvents(true)
    const query = new URLSearchParams({ n: String(s.number), title: s.title, res: s.resolution })
    void win.loadURL(`${BASE_URL}identify.html?${query}`)
    win.once('ready-to-show', () => win.showInactive())
    identifyWins.push(win)
  }
  setTimeout(closeIdentify, 3500)
}

// ── Messaggi dalle pagine ─────────────────────────────────────────────────

function registerIpc() {
  ipcMain.on('app:version', (event) => (event.returnValue = app.getVersion()))

  ipcMain.handle('screens:list', () => {
    const list = describeScreens(screens())
    const saved = readConfig().screens
    const current = choice ?? (isChoiceValid(saved, list) ? saved : defaultChoice(list))
    return { screens: list, choice: current, remember: readConfig().rememberScreens !== false }
  })

  ipcMain.handle('screens:identify', () => identifyScreens())

  ipcMain.handle('screens:start', (_event, { consoleId, displayId, remember }) => {
    const list = screens()
    if (!isChoiceValid({ consoleId, displayId }, list)) return false
    writeConfig({ ...readConfig(), screens: { consoleId, displayId }, rememberScreens: !!remember })
    startMain({ consoleId, displayId })
    setupWin?.close()
    return true
  })

  ipcMain.handle('screens:choose', () => openSetup())

  ipcMain.handle('display:open', () => openDisplay())

  ipcMain.on('game:save', (_event, json) => {
    try {
      if (typeof json === 'string' && json.length < 20_000_000) {
        writeFileAtomic(userFile('partita.json'), json)
      }
    } catch (error) {
      console.error('Salvataggio partita non riuscito:', error)
    }
  })

  ipcMain.on('game:load', (event) => {
    try {
      event.returnValue = fs.readFileSync(userFile('partita.json'), 'utf8')
    } catch {
      event.returnValue = null
    }
  })
}

// ── Protocollo app:// per servire l'interfaccia dalla cartella dist ──────

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

function registerProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)))
    // Nessun accesso fuori dalla cartella dell'interfaccia.
    if (!file.startsWith(DIST)) return new Response('Non trovato', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}

// ── Avvio ─────────────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  // Il programma è già aperto: lo riportiamo in primo piano invece di aprirne un secondo.
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = consoleWin ?? setupWin
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    registerProtocol()
    registerIpc()
    // Niente standby o salvaschermo mentre il programma è aperto.
    powerSaveBlocker.start('prevent-display-sleep')

    screen.on('display-removed', () => {
      if (choice && displayWin) placeDisplay()
    })
    screen.on('display-added', () => {
      if (choice && displayWin) placeDisplay()
    })
    screen.on('display-metrics-changed', () => {
      if (choice && displayWin) placeDisplay()
    })

    const config = readConfig()
    const list = screens()
    if (SMOKE_TEST) {
      startMain(defaultChoice(list))
      void runSmokeTest(SMOKE_TEST)
    } else if (config.rememberScreens && isChoiceValid(config.screens, list)) {
      startMain(config.screens)
    } else {
      openSetup()
    }
  })

  app.on('before-quit', () => (quitting = true))
  app.on('window-all-closed', () => app.quit())
}

// ── Collaudo automatico (solo per lo sviluppo) ───────────────────────────
// TABELLONE_SMOKE_TEST=<cartella> avvia l'app, fotografa le finestre e
// scrive un rapporto, poi esce.

async function runSmokeTest(outDir) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const report = { screens: describeScreens(screens()), windows: {} }
  try {
    await wait(2500)
    const snap = async (name, win) => {
      if (!win || win.isDestroyed()) return (report.windows[name] = null)
      const image = await win.webContents.capturePage()
      fs.writeFileSync(path.join(outDir, `${name}.png`), image.toPNG())
      report.windows[name] = {
        url: win.webContents.getURL(),
        bounds: win.getBounds(),
        fullScreen: win.isFullScreen(),
        title: win.getTitle(),
      }
    }
    // Simula un gol e l'avvio del tempo dalla console.
    await consoleWin.webContents.executeJavaScript(`
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', key: 'c' }));
    `)
    await wait(1500)
    report.consoleText = await consoleWin.webContents.executeJavaScript(
      `document.querySelector('.clock-panel')?.innerText`,
    )
    report.displayScore = await displayWin.webContents.executeJavaScript(
      `[...document.querySelectorAll('.board .score')].map(e => e.textContent.trim())`,
    )
    report.audioUnlocked = await consoleWin.webContents.executeJavaScript(
      `!document.querySelector('.audio-locked')`,
    )
    await wait(7000) // fine animazione del gol
    await snap('console', consoleWin)
    await snap('display', displayWin)
    report.savedGame = fs.existsSync(userFile('partita.json'))

    openSetup()
    await wait(2000)
    await snap('setup', setupWin)
    report.setupText = await setupWin.webContents.executeJavaScript(`document.body.innerText`)
  } catch (error) {
    report.error = String(error?.stack ?? error)
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  quitting = true
  app.exit(0)
}
