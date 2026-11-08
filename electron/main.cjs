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
  shell,
} = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const {
  defaultChoice,
  describeScreens,
  displayPlan,
  isChoiceValid,
  normalizeChoice,
} = require('./screens.cjs')
const { createUpdater } = require('./updater.cjs')

const DIST = path.join(__dirname, '..', 'dist')
// In sviluppo si può puntare al server di Vite: TABELLONE_DEV_URL=http://localhost:5173/
const BASE_URL = process.env.TABELLONE_DEV_URL || 'app://tabellone/'
const SMOKE_TEST = process.env.TABELLONE_SMOKE_TEST // percorso cartella per il collaudo automatico
// TABELLONE_TIMING=1 stampa i tempi di avvio (secondi dall'avvio del processo);
// con un percorso di file li scrive lì (utile per misurare il programma installato).
const timing = (label) => {
  const target = process.env.TABELLONE_TIMING
  if (!target) return
  const line = `[avvio] ${label}: ${process.uptime().toFixed(2)} s`
  if (target === '1') console.log(line)
  else
    fs.appendFileSync(
      target,
      `${Date.now()} ${line}
`,
    )
}
timing('codice principale caricato')

const PRELOAD = path.join(__dirname, 'preload.cjs')
const userFile = (name) => path.join(app.getPath('userData'), name)

/** @type {BrowserWindow | null} */ let consoleWin = null
/**
 * Finestre del tabellone, una per ogni schermo scelto (stessa partita su tutte).
 * Modo: 'fullscreen' sul maxischermo, 'window' se lo schermo è quello della console.
 * `mirror`: schermo girato verso la console, con destra e sinistra rovesciate.
 * @type {Map<number, { win: BrowserWindow, mode: 'fullscreen' | 'window', mirror: boolean }>}
 */
const displayWins = new Map()
/** Il tabellone è aperto (si riapre da solo se si ricollega uno schermo). */
let displayOpen = false
/** @type {BrowserWindow | null} */ let setupWin = null
/** @type {BrowserWindow | null} */ let splashWin = null
/** @type {BrowserWindow[]} */ let identifyWins = []
/** @type {{ consoleId: number, displayIds: number[], mirrorIds: number[] } | null} */ let choice =
  null
let quitting = false
/** Blocco dello standby, attivo per tutta la durata del programma. */
let sleepBlocker = -1

// Aggiornamenti dal sito del progetto (solo nel programma installato).
const updater = createUpdater({
  enabled: !SMOKE_TEST,
  send: (state) => {
    if (consoleWin && !consoleWin.isDestroyed()) consoleWin.webContents.send('update:state', state)
  },
  // Niente richiesta di conferma: il programma si chiude per installare.
  beforeInstall: () => {
    quitting = true
    closeDisplay()
  },
})

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

// ── Lingua delle finestre del programma ──────────────────────────────────
// La sceglie l'operatore nella console; qui serve per la conferma di chiusura
// nativa, la finestra di avvio, i titoli e il numero sugli schermi.

const MAIN_TEXT = {
  it: {
    close: 'Chiudi il programma',
    cancel: 'Annulla',
    closeTitle: 'Chiudere il Tabellone Hockey?',
    closeDetail: 'Anche il tabellone sul maxischermo verrà chiuso. La partita resta salvata.',
    starting: 'Avvio in corso…',
    setup: 'Scelta degli schermi',
    console: 'Console',
    display: 'Maxischermo',
    screen: 'Schermo',
    primary: '(principale)',
  },
  en: {
    close: 'Close the program',
    cancel: 'Cancel',
    closeTitle: 'Close Tabellone Hockey?',
    closeDetail: 'The scoreboard on the big screen will close too. The game stays saved.',
    starting: 'Starting…',
    setup: 'Screen selection',
    console: 'Console',
    display: 'Big screen',
    screen: 'Screen',
    primary: '(main)',
  },
  de: {
    close: 'Programm schließen',
    cancel: 'Abbrechen',
    closeTitle: 'Tabellone Hockey schließen?',
    closeDetail:
      'Auch die Anzeigetafel auf dem Großbildschirm wird geschlossen. Das Spiel bleibt gespeichert.',
    starting: 'Wird gestartet…',
    setup: 'Bildschirmauswahl',
    console: 'Konsole',
    display: 'Großbildschirm',
    screen: 'Bildschirm',
    primary: '(Hauptbildschirm)',
  },
  es: {
    close: 'Cerrar el programa',
    cancel: 'Cancelar',
    closeTitle: '¿Cerrar Tabellone Hockey?',
    closeDetail:
      'También se cerrará el marcador de la pantalla gigante. El partido queda guardado.',
    starting: 'Iniciando…',
    setup: 'Elección de pantallas',
    console: 'Consola',
    display: 'Pantalla gigante',
    screen: 'Pantalla',
    primary: '(principal)',
  },
  fr: {
    close: 'Fermer le programme',
    cancel: 'Annuler',
    closeTitle: 'Fermer Tabellone Hockey ?',
    closeDetail: 'Le tableau sur l’écran géant sera aussi fermé. Le match reste enregistré.',
    starting: 'Démarrage…',
    setup: 'Choix des écrans',
    console: 'Console',
    display: 'Écran géant',
    screen: 'Écran',
    primary: '(principal)',
  },
}

let uiLanguage = Object.hasOwn(MAIN_TEXT, readConfig().language) ? readConfig().language : 'it'
const text = () => MAIN_TEXT[uiLanguage]
const windowTitle = (part) => `Tabellone Hockey – ${text()[part]}`

/** La console ha cambiato lingua: si ricorda e si aggiornano i titoli delle finestre. */
function setUiLanguage(language) {
  if (!Object.hasOwn(MAIN_TEXT, language) || language === uiLanguage) return
  uiLanguage = language
  writeConfig({ ...readConfig(), language })
  if (consoleWin && !consoleWin.isDestroyed()) consoleWin.setTitle(windowTitle('console'))
  if (setupWin && !setupWin.isDestroyed()) setupWin.setTitle(windowTitle('setup'))
  for (const { win } of displayWins.values()) {
    if (!win.isDestroyed()) win.setTitle(windowTitle('display'))
  }
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

/**
 * Blocca navigazioni e finestre esterne: l'app non apre mai pagine web al suo
 * interno. I link https (es. quello dello streaming) si aprono nel browser.
 */
function lockDown(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('display.html')) openDisplay()
    else if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(BASE_URL)) event.preventDefault()
  })
}

// ── Finestra di caricamento ───────────────────────────────────────────────
// Compare subito all'avvio, così si capisce che il programma è partito;
// si chiude appena la prima finestra vera (scelta schermi o console) è pronta.

function showSplash() {
  const primary = screen.getPrimaryDisplay().workArea
  const width = 380
  const height = 250
  splashWin = new BrowserWindow({
    width,
    height,
    x: primary.x + Math.round((primary.width - width) / 2),
    y: primary.y + Math.round((primary.height - height) / 2),
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Tabellone Hockey',
    backgroundColor: '#050d18',
    // Visibile subito, anche prima che il contenuto sia disegnato.
    show: true,
    webPreferences: { sandbox: true, contextIsolation: true },
  })
  splashWin.once('show', () => timing('finestra di caricamento aperta'))
  splashWin.once('ready-to-show', () => timing('finestra di caricamento disegnata'))
  splashWin.on('closed', () => (splashWin = null))
  void splashWin.loadFile(path.join(__dirname, 'splash.html'), {
    query: { lang: uiLanguage, text: text().starting },
  })
}

function closeSplash() {
  if (splashWin && !splashWin.isDestroyed()) splashWin.close()
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
    title: windowTitle('setup'),
    backgroundColor: '#050d18',
    show: false,
    webPreferences: baseWebPreferences(),
  })
  lockDown(setupWin)
  setupWin.once('ready-to-show', () => {
    timing('scelta schermi visibile')
    setupWin?.show()
    closeSplash()
  })
  setupWin.on('closed', () => {
    setupWin = null
    closeIdentify()
    // Chiusa senza scegliere e senza console aperta: si esce.
    if (!consoleWin && !quitting) app.quit()
  })
  void setupWin.loadURL(`${BASE_URL}setup.html`)
}

/** true mentre è il programma stesso a ingrandire la console (non il pulsante di Windows). */
let maximizingConsole = false

function maximizeConsole() {
  if (!consoleWin || consoleWin.isDestroyed()) return
  maximizingConsole = true
  consoleWin.maximize()
  maximizingConsole = false
}

let consoleFull = false

/**
 * Schermo intero vero della console, che copre anche la barra Start.
 * Lo schermo intero di Windows/Electron qui lascia la barra Start visibile
 * (c'è il tabellone "sempre in primo piano" sull'altro schermo), quindi la
 * finestra si allarga a tutto lo schermo e sta in primo piano finché ha il fuoco.
 */
function setConsoleFullScreen(on) {
  const win = consoleWin
  if (!win || win.isDestroyed() || on === consoleFull) return
  consoleFull = on
  if (on) {
    const d = screen.getDisplayMatching(win.getBounds())
    const cover = () => {
      if (win.isDestroyed() || !consoleFull) return
      // Un punto in più in basso: con la misura esatta Windows lascia l'ultima
      // riga di pixel alla barra Start.
      win.setBounds({ ...d.bounds, height: d.bounds.height + 1 })
      // Bloccata lì: non si sposta trascinando la barra.
      win.setMovable(false)
      keepConsoleOnTop()
    }
    // Da ingrandita prima si torna a finestra normale (Windows lo fa con calma),
    // poi la si allarga: altrimenti il ripristino annullerebbe le misure.
    if (win.isMaximized()) {
      win.once('unmaximize', () => setTimeout(cover, 50))
      win.unmaximize()
    } else cover()
  } else {
    win.setMovable(true)
    // Torna una finestra normale, un po' più piccola dello schermo.
    const d = screen.getDisplayMatching(win.getBounds())
    const restore = () => {
      if (win.isDestroyed() || consoleFull) return
      win.setBounds(consoleNormalBounds(d))
    }
    if (win.isMaximized()) {
      win.once('unmaximize', () => setTimeout(restore, 50))
      win.unmaximize()
    } else restore()
  }
  keepConsoleOnTop()
  win.webContents.send('console:fullscreen', on)
}

/** In primo piano (sopra la barra Start) solo a schermo intero e con il fuoco. */
function keepConsoleOnTop() {
  const win = consoleWin
  if (!win || win.isDestroyed()) return
  if (consoleFull && win.isFocused()) {
    // Windows rimette la barra Start sopra: si spegne e riaccende il "primo
    // piano" così la console torna in cima.
    win.setAlwaysOnTop(false)
    win.setAlwaysOnTop(true, 'screen-saver')
    win.moveTop()
  } else {
    win.setAlwaysOnTop(false)
  }
}

/** Grandezza della console quando non è ingrandita: un po' più piccola dello schermo, al centro. */
function consoleNormalBounds(d) {
  const { x, y, width, height } = d.workArea
  const w = Math.round(width * 0.85)
  const h = Math.round(height * 0.85)
  return {
    x: x + Math.round((width - w) / 2),
    y: y + Math.round((height - h) / 2),
    width: w,
    height: h,
  }
}

function placeConsole() {
  if (!choice) return
  const d = displayById(choice.consoleId)
  if (!consoleWin || consoleWin.isDestroyed()) {
    consoleWin = new BrowserWindow({
      ...consoleNormalBounds(d),
      minWidth: 900,
      minHeight: 600,
      title: windowTitle('console'),
      backgroundColor: '#050d18',
      // Barra del titolo disegnata dalla console, compresi i pulsanti
      // (riduci, schermo intero/finestra, chiudi): quelli di Windows non
      // saprebbero mostrare lo schermo intero vero.
      titleBarStyle: 'hidden',
      show: false,
      webPreferences: baseWebPreferences(),
    })
    lockDown(consoleWin)
    consoleWin.once('ready-to-show', () => {
      timing('console visibile')
      maximizeConsole()
      consoleWin?.show()
      // All'avvio la console va a schermo intero, tranne quando il tabellone è
      // sullo stesso schermo (lo coprirebbe): lì resta una finestra.
      if (choice && !choice.displayIds.includes(choice.consoleId) && screens().length > 1) {
        setConsoleFullScreen(true)
      }
      closeSplash()
    })
    consoleWin.on('focus', keepConsoleOnTop)
    consoleWin.on('blur', keepConsoleOnTop)
    // Il pulsante "Ingrandisci" di Windows porta allo schermo intero vero,
    // senza la barra Start (come F11 e il pulsante della console).
    consoleWin.on('maximize', () => {
      // A schermo intero lo stesso pulsante ne esce.
      if (!maximizingConsole) setTimeout(() => setConsoleFullScreen(!consoleFull), 0)
    })
    consoleWin.on('close', (event) => {
      if (quitting || SMOKE_TEST) return
      // Chiudere la console chiude tutto: la conferma la chiede la console
      // con una finestra sua (vedi requestClose).
      event.preventDefault()
      requestClose()
    })
    consoleWin.on('closed', () => {
      consoleWin = null
      consoleFull = false
      quitting = true
      closeDisplay()
      app.quit()
    })
    void consoleWin.loadURL(`${BASE_URL}index.html`)
  } else {
    // Cambio di schermo: si sposta la finestra e, se era a schermo intero, ci torna.
    const wasFullScreen = consoleFull
    if (wasFullScreen) setConsoleFullScreen(false)
    if (consoleWin.isMaximized()) consoleWin.unmaximize()
    consoleWin.setBounds(consoleNormalBounds(d))
    maximizeConsole()
    if (wasFullScreen) setConsoleFullScreen(true)
  }
}

/**
 * Dove e come mostrare il tabellone: uno o più schermi, con lo stesso tabellone.
 * Sul maxischermo (schermo diverso da quello della console) va a schermo intero,
 * senza barra del titolo; se è lo schermo della console (es. prove a casa)
 * resta una finestra normale. Gli schermi scollegati si saltano; se non ne
 * resta nessuno, il tabellone va in una finestra sullo schermo della console.
 */
function displayTargets() {
  if (!choice) return []
  // Solo per i collaudi: forza lo schermo intero anche con un solo monitor.
  const forced = process.env.TABELLONE_DISPLAY_FULLSCREEN === '1'
  return displayPlan(choice, screens(), forced).map(({ id, mode, mirror }) => ({
    display: displayById(id),
    mode,
    mirror,
  }))
}

function windowedBounds(d) {
  const w = Math.round(d.workArea.width * 0.6)
  const h = Math.round((w * 9) / 16)
  return {
    x: d.workArea.x + Math.round((d.workArea.width - w) / 2),
    y: d.workArea.y + Math.round((d.workArea.height - h) / 2),
    width: w,
    height: h,
  }
}

function goFullScreen(win, d) {
  if (win.isFullScreen()) win.setFullScreen(false)
  win.setBounds(d.bounds)
  win.setFullScreen(true)
  // Sopra a tutto su quello schermo, anche alla barra delle applicazioni di Windows.
  win.setAlwaysOnTop(true, 'screen-saver')
}

// ── Conferma di chiusura ──────────────────────────────────────────────────
// La console mostra una sua finestra di conferma. Se non risponde entro poco
// (es. pagina bloccata), si usa l'avviso di Windows: il programma deve
// restare sempre chiudibile.

let closePending = false
/** @type {ReturnType<typeof setTimeout> | undefined} */ let closeAckTimer

function requestClose() {
  if (!consoleWin || closePending) return
  closePending = true
  if (consoleWin.isMinimized()) consoleWin.restore()
  consoleWin.focus()
  consoleWin.webContents.send('app:close-requested')
  closeAckTimer = setTimeout(() => {
    closePending = false
    nativeCloseConfirm()
  }, 1500)
}

// let: il collaudo automatico la sostituisce per verificare che non serva.
let nativeCloseConfirm = function () {
  if (!consoleWin) return
  const answer = dialog.showMessageBoxSync(consoleWin, {
    type: 'question',
    buttons: [text().close, text().cancel],
    defaultId: 1,
    cancelId: 1,
    title: text().closeTitle,
    message: text().closeTitle,
    detail: text().closeDetail,
  })
  if (answer === 0) quitApp()
}

function quitApp() {
  quitting = true
  consoleWin?.close()
}

/**
 * Allinea le finestre del tabellone agli schermi scelti: crea quelle che
 * mancano, chiude quelle in più e rimette al loro posto le altre.
 */
function syncDisplays() {
  if (!choice || !displayOpen) return
  const targets = displayTargets()
  const wanted = new Map(targets.map((t) => [t.display.id, t]))
  for (const [id, entry] of [...displayWins]) {
    const target = wanted.get(id)
    // Il tipo di finestra (con o senza barra) e il verso si decidono alla creazione: si ricrea.
    if (
      !target ||
      target.mode !== entry.mode ||
      target.mirror !== entry.mirror ||
      entry.win.isDestroyed()
    ) {
      destroyDisplay(id)
    }
  }
  for (const target of targets) {
    const entry = displayWins.get(target.display.id)
    if (!entry) createDisplay(target)
    else if (target.mode === 'fullscreen') goFullScreen(entry.win, target.display)
    else entry.win.setBounds(windowedBounds(target.display))
  }
}

function createDisplay({ display: d, mode, mirror }) {
  const fullscreen = mode === 'fullscreen'
  const id = d.id
  const win = new BrowserWindow({
    ...(fullscreen ? d.bounds : windowedBounds(d)),
    title: windowTitle('display'),
    backgroundColor: '#000000',
    // Sul maxischermo: niente barra del titolo, niente pulsanti, niente icona
    // nella barra delle applicazioni. Si chiude solo dalla console.
    frame: !fullscreen,
    fullscreen,
    resizable: !fullscreen,
    movable: !fullscreen,
    minimizable: !fullscreen,
    maximizable: !fullscreen,
    closable: !fullscreen,
    skipTaskbar: fullscreen,
    autoHideMenuBar: true,
    show: false,
    webPreferences: baseWebPreferences(),
  })
  displayWins.set(id, { win, mode, mirror })
  lockDown(win)
  win.once('ready-to-show', () => {
    // Senza rubare il focus alla console: l'operatore continua a usare la tastiera.
    win.showInactive()
    if (fullscreen) goFullScreen(win, displayById(id))
  })
  // Alt+F4 o altri tentativi di chiusura dal maxischermo vengono ignorati.
  win.on('close', (event) => {
    if (fullscreen && !quitting) event.preventDefault()
  })
  win.on('closed', () => {
    // Ancora nell'elenco = chiusa con la X (finestra normale), non da noi:
    // se era l'ultima, il tabellone è chiuso.
    if (displayWins.get(id)?.win !== win) return
    displayWins.delete(id)
    if (displayWins.size === 0) displayOpen = false
  })
  void win.loadURL(`${BASE_URL}display.html${mirror ? '?mirror=1' : ''}`)
}

function destroyDisplay(id) {
  const entry = displayWins.get(id)
  displayWins.delete(id)
  if (entry && !entry.win.isDestroyed()) entry.win.destroy()
}

function openDisplay() {
  if (!choice) return
  const existing = [...displayWins.values()].map((e) => e.win)
  displayOpen = true
  syncDisplays()
  for (const win of existing) if (!win.isDestroyed()) win.showInactive()
}

/** Chiude il tabellone su tutti gli schermi (solo su richiesta della console o all'uscita). */
function closeDisplay() {
  displayOpen = false
  for (const id of [...displayWins.keys()]) destroyDisplay(id)
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
    const title = [`${text().screen} ${s.number}`, s.primary ? text().primary : '']
      .filter(Boolean)
      .join(' ')
    const query = new URLSearchParams({
      n: String(s.number),
      title: title + (s.label ? ` – ${s.label}` : ''),
      res: s.resolution,
    })
    void win.loadURL(`${BASE_URL}identify.html?${query}`)
    win.once('ready-to-show', () => win.showInactive())
    identifyWins.push(win)
  }
  setTimeout(closeIdentify, 3500)
}

// ── Messaggi dalle pagine ─────────────────────────────────────────────────

function registerIpc() {
  ipcMain.on('app:version', (event) => (event.returnValue = app.getVersion()))

  ipcMain.handle('update:state', () => updater.getState())
  ipcMain.handle('update:check', () => updater.check())
  ipcMain.handle('update:install', () => updater.install())

  ipcMain.handle('screens:list', () => {
    const list = describeScreens(screens())
    const saved = readConfig().screens
    const current =
      choice ?? (isChoiceValid(saved, list) ? normalizeChoice(saved) : defaultChoice(list))
    return { screens: list, choice: current, remember: readConfig().rememberScreens !== false }
  })

  ipcMain.handle('screens:identify', () => identifyScreens())

  ipcMain.handle('screens:start', (_event, { consoleId, displayIds, mirrorIds, remember }) => {
    const list = screens()
    const next = normalizeChoice({ consoleId, displayIds, mirrorIds })
    if (!next || !isChoiceValid(next, list)) return false
    writeConfig({ ...readConfig(), screens: next, rememberScreens: !!remember })
    startMain(next)
    setupWin?.close()
    return true
  })

  ipcMain.handle('screens:choose', () => openSetup())

  ipcMain.handle('display:open', () => openDisplay())
  ipcMain.handle('display:close', () => closeDisplay())

  // Schermo intero della console (all'avvio è una finestra ingrandita normale).
  ipcMain.handle('console:set-fullscreen', (_event, on) => {
    setConsoleFullScreen(!!on)
  })
  ipcMain.handle('console:is-fullscreen', () => consoleFull)
  ipcMain.on('console:minimize', () => consoleWin?.minimize())
  // La X della console: chiude tutto, dopo la conferma.
  ipcMain.on('app:request-close', () => requestClose())

  // La console ha ricevuto la richiesta di chiusura e mostra la sua finestra.
  ipcMain.on('app:close-ack', () => clearTimeout(closeAckTimer))
  ipcMain.on('app:language', (_event, language) => setUiLanguage(String(language)))
  // Risposta dell'operatore: true = chiudi il programma.
  ipcMain.on('app:close-answer', (_event, confirmed) => {
    clearTimeout(closeAckTimer)
    closePending = false
    if (confirmed) quitApp()
  })

  // Quali file della playlist ci sono ancora (chiavette e cartelle possono sparire).
  ipcMain.handle('music:check', (_event, files) =>
    Promise.all(
      (Array.isArray(files) ? files : []).map((file) =>
        isAudioPath(file)
          ? fs.promises.access(file, fs.constants.R_OK).then(
              () => true,
              () => false,
            )
          : false,
      ),
    ),
  )

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
  {
    scheme: 'tabellone-audio',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

// Tracce audio: solo file audio con percorso completo, nient'altro del disco.
const AUDIO_FILE = /\.(mp3|wav|ogg|oga|opus|m4a|aac|flac|webm)$/i
const isAudioPath = (file) =>
  typeof file === 'string' && path.isAbsolute(file) && AUDIO_FILE.test(file)

function registerProtocol() {
  protocol.handle('tabellone-audio', (request) => {
    const file = decodeURIComponent(new URL(request.url).pathname.slice(1))
    if (!isAudioPath(file)) return new Response('Non trovato', { status: 404 })
    // L'intestazione Range serve a far avanzare il file poco alla volta.
    return net.fetch(pathToFileURL(file).toString(), { headers: request.headers })
  })
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
    timing('Electron pronto')
    // Per prima cosa la finestra di caricamento; il resto dopo.
    if (!SMOKE_TEST) showSplash()
    Menu.setApplicationMenu(null)
    registerProtocol()
    registerIpc()
    // Niente standby o salvaschermo mentre il programma è aperto.
    sleepBlocker = powerSaveBlocker.start('prevent-display-sleep')

    screen.on('display-removed', () => {
      syncDisplays()
    })
    screen.on('display-added', () => {
      syncDisplays()
    })
    screen.on('display-metrics-changed', () => {
      syncDisplays()
    })

    const config = readConfig()
    const list = screens()
    if (SMOKE_TEST) {
      // TABELLONE_SMOKE_ALL_SCREENS=1: tabellone su tutti gli schermi collegati.
      const all = process.env.TABELLONE_SMOKE_ALL_SCREENS === '1'
      const base = defaultChoice(list)
      startMain(all && base ? { ...base, displayIds: list.map((s) => s.id) } : base)
      void runSmokeTest(SMOKE_TEST)
    } else if (config.rememberScreens && isChoiceValid(config.screens, list)) {
      startMain(normalizeChoice(config.screens))
    } else {
      openSetup()
    }
    // Subito, senza aspettare la scelta degli schermi: la console legge l'esito
    // appena si apre.
    updater.start()
  })

  app.on('before-quit', () => {
    quitting = true
    closeDisplay()
  })
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
    const firstDisplay = () => [...displayWins.values()][0]?.win ?? null
    report.displayScore = await firstDisplay().webContents.executeJavaScript(
      `[...document.querySelectorAll('.board .score')].map(e => e.textContent.trim())`,
    )
    // Tutte le finestre del tabellone mostrano la stessa partita.
    report.displayScores = await Promise.all(
      [...displayWins.values()].map(async ({ win, mode }) => ({
        mode,
        fullScreen: win.isFullScreen(),
        bounds: win.getBounds(),
        score: await win.webContents.executeJavaScript(
          `[...document.querySelectorAll('.board .score')].map(e => e.textContent.trim())`,
        ),
      })),
    )
    report.audioUnlocked = await consoleWin.webContents.executeJavaScript(
      `!document.querySelector('.audio-locked')`,
    )
    // Streaming: dal programma installato il servizio online deve essere
    // raggiungibile (CORS dall'origine app://). Senza internet risulta false.
    report.streamingService = await consoleWin.webContents.executeJavaScript(
      `fetch('https://live.tabellone-hockey.workers.dev/api/info').then((r) => r.json()).catch((e) => String(e))`,
    )
    await wait(7000) // fine animazione del gol
    await snap('console', consoleWin)
    await snap('display', firstDisplay())
    report.savedGame = fs.existsSync(userFile('partita.json'))
    report.noSleep = powerSaveBlocker.isStarted(sleepBlocker)

    // Tabellone: schermo intero senza barra e chiudibile solo dalla console.
    const dw = firstDisplay()
    report.displayWindow = {
      windows: displayWins.size,
      mode: [...displayWins.values()][0]?.mode,
      fullScreen: dw.isFullScreen(),
      alwaysOnTop: dw.isAlwaysOnTop(),
      // Senza barra del titolo la parte disegnabile coincide con la finestra intera.
      noTitleBar:
        dw.getContentBounds().height === dw.getBounds().height &&
        dw.getContentBounds().y === dw.getBounds().y,
      bounds: dw.getBounds(),
      screen: displayTargets()[0]?.display.bounds,
    }
    dw.close() // come Alt+F4 sul maxischermo
    await wait(500)
    report.displayWindow.survivesCloseAttempt = !dw.isDestroyed() && firstDisplay() === dw
    await consoleWin.webContents.executeJavaScript(`window.tabelloneApp.closeDisplay()`)
    await wait(500)
    report.displayWindow.closedFromConsole = displayWins.size === 0 && dw.isDestroyed()
    await wait(4000) // la console se ne accorge (nessun segnale dal tabellone)
    report.consoleButtonAfterClose = await consoleWin.webContents.executeJavaScript(
      `[...document.querySelectorAll('.display-control button')].map((b) => b.textContent.trim())`,
    )
    // Chiusura: la console deve mostrare la sua finestra di conferma.
    let nativeUsed = false
    const originalNative = nativeCloseConfirm
    nativeCloseConfirm = () => (nativeUsed = true)
    requestClose()
    await wait(900)
    await snap('chiusura', consoleWin)
    report.quitDialog = await consoleWin.webContents.executeJavaScript(
      `document.querySelector('dialog[open] h2')?.textContent ?? null`,
    )
    await consoleWin.webContents.executeJavaScript(
      `[...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent.includes('Annulla'))?.click()`,
    )
    await wait(2000)
    report.quitCancelled = {
      consoleOpen: !!consoleWin && !consoleWin.isDestroyed(),
      pending: closePending,
      nativeUsed,
    }
    nativeCloseConfirm = originalNative

    openDisplay()
    await wait(2500)
    const reopened = [...displayWins.values()][0]
    report.displayWindow.reopened =
      !!reopened && reopened.win.isFullScreen() === (reopened.mode === 'fullscreen')

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
