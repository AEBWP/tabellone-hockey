// Aggiornamento automatico dalle release del progetto su GitHub.
//
// - Appena il programma è partito, e poi ogni poche ore, controlla se c'è una
//   versione più recente (file latest.yml pubblicato con ogni release).
// - Non scarica niente da solo: quando l'operatore preme "Aggiorna" scarica
//   l'installer (solo le parti cambiate, se possibile), ne verifica l'impronta
//   SHA-512, chiude il programma, installa senza domande e lo riapre.
// - Partita, squadre e impostazioni sono nella cartella dei dati dell'utente:
//   l'installazione non le tocca.
//
// La libreria electron-updater si carica solo al primo controllo, un attimo
// dopo l'apertura delle finestre, per non rallentare l'avvio.

const { app } = require('electron')

const FIRST_CHECK_MS = 1_000
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

/**
 * @typedef {'unsupported' | 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'installing' | 'error'} UpdateStatus
 * @typedef {{
 *   status: UpdateStatus,
 *   current: string,
 *   version?: string,
 *   percent?: number,
 *   transferred?: number,
 *   total?: number,
 *   error?: 'offline' | 'check' | 'download' | 'install',
 *   detail?: string,
 *   checkedAt?: number,
 * }} UpdateState
 */

/**
 * Tipo di errore, per un messaggio comprensibile nella console.
 * @param {string} message
 * @param {'check' | 'download' | 'install'} phase
 */
function errorKind(message, phase) {
  if (
    /ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NETWORK_CHANGED|ERR_CONNECTION|ERR_TIMED_OUT|ERR_ADDRESS_UNREACHABLE|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|net::ERR_PROXY/i.test(
      message,
    )
  )
    return 'offline'
  return phase
}

/**
 * Messaggio tecnico breve (senza lo stack), per la sezione "Dettagli tecnici".
 * @param {unknown} error
 */
function shortDetail(error) {
  const message = String(/** @type {Error} */ (error)?.message ?? error)
  return message.split('\n').slice(0, 2).join(' ').slice(0, 300)
}

/**
 * Indirizzo alternativo per le prove con un server locale
 * (TABELLONE_UPDATE_URL=http://localhost:8123/). Solo indirizzi locali.
 * @param {string | undefined} value
 */
function localFeed(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null
    return url.toString()
  } catch {
    return null
  }
}

/**
 * @param {{ send: (state: UpdateState) => void, beforeInstall: () => void, enabled: boolean }} options
 */
function createUpdater({ send, beforeInstall, enabled }) {
  const feed = localFeed(process.env.TABELLONE_UPDATE_URL)
  // Si aggiorna solo il programma installato (o una prova con il server locale).
  const supported = enabled && (app.isPackaged || !!feed)

  /** @type {UpdateState} */
  let state = { status: supported ? 'idle' : 'unsupported', current: app.getVersion() }
  /** @type {import('electron-updater').AppUpdater | null} */
  let updater = null
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timer

  /** @param {Partial<UpdateState>} patch */
  function set(patch, replace = false) {
    state = replace ? { current: state.current, status: 'idle', ...patch } : { ...state, ...patch }
    send(state)
  }

  function load() {
    if (updater) return updater
    const { autoUpdater } = require('electron-updater')
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowPrerelease = false
    autoUpdater.allowDowngrade = false
    autoUpdater.logger = null
    if (feed) {
      autoUpdater.forceDevUpdateConfig = true
      autoUpdater.setFeedURL({ provider: 'generic', url: feed })
    }
    autoUpdater.on('download-progress', (p) => {
      if (state.status !== 'downloading') return
      set({
        percent: Math.max(0, Math.min(100, Math.round(p.percent))),
        transferred: p.transferred,
        total: p.total,
      })
    })
    updater = autoUpdater
    return autoUpdater
  }

  async function check() {
    if (!supported) return state
    if (['checking', 'downloading', 'installing'].includes(state.status)) return state
    const keepVersion = state.status === 'available' ? state.version : undefined
    set({ status: 'checking', error: undefined, detail: undefined })
    try {
      const result = await load().checkForUpdates()
      if (result?.isUpdateAvailable) {
        set(
          { status: 'available', version: result.updateInfo.version, checkedAt: Date.now() },
          true,
        )
      } else {
        set({ status: 'none', checkedAt: Date.now() }, true)
      }
    } catch (error) {
      const detail = shortDetail(error)
      // Se era già stata trovata una versione nuova, resta proponibile.
      if (keepVersion) set({ status: 'available', version: keepVersion }, true)
      else set({ status: 'error', error: errorKind(detail, 'check'), detail }, true)
    }
    return state
  }

  async function install() {
    if (!supported || !updater) return state
    if (state.status !== 'available' && !(state.status === 'error' && state.version)) return state
    const version = state.version
    set({ status: 'downloading', percent: 0, transferred: 0, total: undefined, error: undefined })
    try {
      await updater.downloadUpdate()
    } catch (error) {
      const detail = shortDetail(error)
      set({ status: 'error', version, error: errorKind(detail, 'download'), detail }, true)
      return state
    }
    set({ status: 'installing', percent: 100 })
    // Un attimo per mostrare "Installazione…" prima che il programma si chiuda.
    setTimeout(() => {
      try {
        beforeInstall()
        // Installazione silenziosa, poi il programma si riapre da solo.
        updater?.quitAndInstall(true, true)
      } catch (error) {
        const detail = shortDetail(error)
        set({ status: 'error', version, error: 'install', detail }, true)
      }
    }, 1200)
    return state
  }

  function start() {
    if (!supported || timer) return
    setTimeout(() => void check(), FIRST_CHECK_MS)
    timer = setInterval(() => void check(), CHECK_EVERY_MS)
  }

  return { start, check, install, getState: () => state }
}

module.exports = { createUpdater, errorKind, localFeed, shortDetail }
