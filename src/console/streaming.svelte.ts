import { LANGUAGES, type GameState, type Language } from '../engine'
import { ui } from '../i18n/ui.svelte'
import {
  isValidLiveName,
  LIVE_DEFAULT_SERVICE,
  LIVE_HEARTBEAT_MS,
  LIVE_PROTOCOL,
  liveLink,
  splitLogos,
  cleanKeys,
  mergeKeys,
  type LiveUpdate,
  type StreamingBackup,
  type StreamingKey,
} from '../shared/live'
import { now } from '../shared/time'

/**
 * Streaming su internet: la console invia la situazione della partita al
 * servizio online, che la mostra a chi apre il link del palaghiaccio.
 *
 * - Il nome (ultima parte del link) si registra una volta: il servizio
 *   restituisce una chiave segreta, salvata solo su questo PC. Senza la
 *   chiave nessun altro può trasmettere con quel nome.
 * - Lo streaming parte solo quando l'operatore lo avvia, e si ferma alla
 *   chiusura del programma.
 */

const STORAGE_KEY = 'tabellone-hockey:streaming'

export interface StreamingSettings {
  /** Indirizzo del servizio online (cambia solo nelle impostazioni avanzate). */
  service: string
  /** Nome registrato ('' se nessuno). */
  name: string
  /** Chiave segreta del nome registrato. */
  key: string
  /** Logo al centro del QR code (null = logo del programma). */
  qrLogo: string | null
  /**
   * Lingua iniziale per chi apre il link (poi ognuno può cambiarla). Di base è
   * quella scelta al primo avvio del programma.
   */
  language: Language
  /**
   * Tutti i nomi registrati da questa console, con la loro chiave. Le chiavi
   * vengono date una volta sola dal servizio: si tengono qui (e nel backup) per
   * poter tornare a un nome già usato o spostarlo su un altro PC.
   */
  keys: StreamingKey[]
}

export type StreamingStatus = 'off' | 'connecting' | 'live' | 'error'

const DEFAULTS = (): StreamingSettings => ({
  service: LIVE_DEFAULT_SERVICE,
  name: '',
  key: '',
  qrLogo: null,
  language: ui.lang,
  keys: [],
})

function load(): StreamingSettings {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null')
    if (saved && typeof saved === 'object') {
      const defaults = DEFAULTS()
      const s = { ...defaults, ...saved }
      return {
        service: typeof s.service === 'string' && s.service ? s.service : defaults.service,
        name: typeof s.name === 'string' && isValidLiveName(s.name) ? s.name : '',
        key: typeof s.key === 'string' ? s.key : '',
        qrLogo: typeof s.qrLogo === 'string' ? s.qrLogo : null,
        language: LANGUAGES.includes(s.language) ? s.language : defaults.language,
        keys: cleanKeys(s.keys),
      }
    }
  } catch {
    // Impostazioni illeggibili: si riparte da zero.
  }
  return DEFAULTS()
}

/**
 * Il nome in uso è sempre anche nell'elenco delle chiavi (le versioni
 * precedenti tenevano solo quello).
 */
function withCurrentKey(settings: StreamingSettings): StreamingSettings {
  const { service, name, key } = settings
  if (!name || !key) return settings
  const keys = mergeKeys(settings.keys, [
    { service: cleanService(service), name, key, claimedAt: 0 },
  ])
  return { ...settings, keys }
}

/** Errore con un messaggio da mostrare all'operatore (frase italiana, tradotta al momento). */
export class StreamingError extends Error {}

const cleanService = (url: string) => url.trim().replace(/\/+$/, '')

class Streaming {
  settings = $state<StreamingSettings>(withCurrentKey(load()))
  status = $state<StreamingStatus>('off')
  /** Ultimo errore (frase italiana da tradurre), se lo streaming ha problemi. */
  error = $state<string | null>(null)
  /** Operazione in corso (registrazione, avvio, arresto). */
  busy = $state(false)

  readonly link = $derived(
    this.settings.name ? liveLink(this.settings.service, this.settings.name) : null,
  )
  readonly active = $derived(this.status !== 'off')

  private getState: (() => GameState) | null = null
  private pushTimer: ReturnType<typeof setTimeout> | undefined
  private heartbeat: ReturnType<typeof setInterval> | undefined
  private retryDelay = 0
  private sending = false
  private pending = false

  private save() {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.settings))
    } catch {
      // Non salvato: vale fino alla chiusura.
    }
  }

  private url(path = '') {
    return `${cleanService(this.settings.service)}/api/channels/${this.settings.name}${path}`
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetch(this.url(path), {
        ...init,
        headers: { Authorization: `Bearer ${this.settings.key}`, ...init.headers },
      })
    } catch {
      throw new StreamingError(
        'Servizio online non raggiungibile: controlla la connessione a internet.',
      )
    }
  }

  /** La console comunica da dove prendere la situazione da inviare. */
  attach(getState: () => GameState) {
    this.getState = getState
    // Alla chiusura del programma lo streaming si ferma: gli spettatori vedono la pagina d'attesa.
    globalThis.addEventListener?.('pagehide', () => {
      if (this.active && this.settings.key) {
        void fetch(this.url('/stop'), {
          method: 'POST',
          keepalive: true,
          headers: { Authorization: `Bearer ${this.settings.key}` },
        }).catch(() => {})
      }
    })
  }

  /**
   * Registra un nuovo nome per il link. Se ce n'era già uno, viene liberato:
   * chi aveva il link vecchio non vede più lo streaming.
   */
  async register(name: string): Promise<void> {
    if (!isValidLiveName(name)) {
      throw new StreamingError('Nome non valido: usa da 3 a 40 lettere, numeri o trattini.')
    }
    if (name === this.settings.name && this.settings.key) return
    // Nome già registrato da questa console (o arrivato da un backup): si torna a usarlo.
    const owned = this.ownKey(name)
    if (owned) {
      this.switchTo(owned.name, owned.key)
      return
    }
    this.busy = true
    try {
      let res: Response
      try {
        res = await fetch(`${cleanService(this.settings.service)}/api/channels/${name}/claim`, {
          method: 'POST',
        })
      } catch {
        throw new StreamingError(
          'Servizio online non raggiungibile: controlla la connessione a internet.',
        )
      }
      if (res.status === 409) {
        throw new StreamingError(
          'Questo nome è già usato da un altro palaghiaccio: scegline un altro.',
        )
      }
      if (res.status === 400) {
        throw new StreamingError('Nome non valido: usa da 3 a 40 lettere, numeri o trattini.')
      }
      if (!res.ok)
        throw new StreamingError('Il servizio online ha risposto con un errore. Riprova.')
      const { key } = (await res.json()) as { key: string }
      const service = cleanService(this.settings.service)
      this.settings = {
        ...this.settings,
        keys: mergeKeys(this.settings.keys, [{ service, name, key, claimedAt: Date.now() }]),
      }
      this.switchTo(name, key)
    } finally {
      this.busy = false
    }
  }

  /** Chiave salvata per un nome sul servizio in uso. */
  ownKey(name: string): StreamingKey | undefined {
    const service = cleanService(this.settings.service)
    return this.settings.keys.find((k) => k.service === service && k.name === name)
  }

  /** Nomi registrati da questa console sul servizio in uso. */
  get ownNames(): string[] {
    const service = cleanService(this.settings.service)
    return this.settings.keys.filter((k) => k.service === service).map((k) => k.name)
  }

  /**
   * Passa a un altro nome di questa console. Il nome lasciato resta registrato
   * (con la sua chiave), ma chi lo guarda vede la pagina d'attesa.
   */
  private switchTo(name: string, key: string) {
    const old = { name: this.settings.name, key: this.settings.key }
    const wasActive = this.active
    if (wasActive && old.name && old.key && old.name !== name) {
      void fetch(this.url('/stop'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${old.key}` },
      }).catch(() => {})
    }
    this.settings = { ...this.settings, name, key }
    this.save()
    if (wasActive) this.push(true)
  }

  /**
   * Libera il nome: il link e il QR code non funzionano più, il nome può
   * prenderlo qualcun altro e la sua chiave si butta.
   */
  async release(): Promise<void> {
    this.stopTimers()
    this.status = 'off'
    this.error = null
    const { name, key } = this.settings
    if (name && key) {
      await this.request('', { method: 'DELETE' }).catch(() => {})
    }
    const service = cleanService(this.settings.service)
    this.settings = {
      ...this.settings,
      name: '',
      key: '',
      keys: this.settings.keys.filter((k) => !(k.service === service && k.name === name)),
    }
    this.save()
  }

  /** Nomi e chiavi da mettere nel file di backup. */
  backup(): StreamingBackup {
    const { service, name } = this.settings
    return {
      keys: $state.snapshot(this.settings.keys),
      ...(name ? { current: { service: cleanService(service), name } } : {}),
    }
  }

  /**
   * Chiavi da un backup: si aggiungono a quelle di questa console. Se qui non
   * c'è ancora un nome in uso, si usa quello del backup.
   */
  restore(data: StreamingBackup) {
    const keys = mergeKeys(this.settings.keys, data.keys)
    this.settings = { ...this.settings, keys }
    const current = data.current
    const found =
      current && keys.find((k) => k.service === current.service && k.name === current.name)
    if (!this.settings.name && found && !this.active) {
      this.settings = { ...this.settings, service: found.service, name: found.name, key: found.key }
    }
    this.save()
  }

  /** Cambia il servizio online: il nome va registrato di nuovo lì. */
  async setService(url: string): Promise<void> {
    const service = cleanService(url) || LIVE_DEFAULT_SERVICE
    if (!/^https?:\/\/[^/\s]+/.test(service)) {
      throw new StreamingError('Indirizzo del servizio non valido (es. https://…).')
    }
    if (service === cleanService(this.settings.service)) return
    // Il nome resta registrato sul servizio vecchio (la chiave è salvata): qui si riparte senza.
    await this.stop()
    this.settings = { ...this.settings, service, name: '', key: '' }
    this.save()
  }

  setQrLogo(logo: string | null) {
    this.settings = { ...this.settings, qrLogo: logo }
    this.save()
  }

  /** Lingua iniziale degli spettatori: arriva subito anche a chi sta già guardando. */
  setLanguage(language: Language) {
    if (!LANGUAGES.includes(language)) return
    const changed = language !== this.settings.language
    this.settings = { ...this.settings, language }
    // Salvata anche se uguale: non deve più seguire la lingua della console.
    this.save()
    if (changed && this.active) this.push(true)
  }

  start() {
    if (!this.settings.name || !this.settings.key || this.active) return
    this.status = 'connecting'
    this.error = null
    this.retryDelay = 0
    this.heartbeat = setInterval(() => this.push(true), LIVE_HEARTBEAT_MS)
    this.push(true)
  }

  async stop(): Promise<void> {
    if (!this.active) return
    this.stopTimers()
    this.status = 'off'
    this.error = null
    this.busy = true
    try {
      await this.request('/stop', { method: 'POST' })
    } catch {
      // Senza rete gli spettatori vedranno "collegamento interrotto".
    } finally {
      this.busy = false
    }
  }

  private stopTimers() {
    clearTimeout(this.pushTimer)
    clearInterval(this.heartbeat)
    this.pushTimer = undefined
    this.heartbeat = undefined
  }

  /** Nuova situazione da inviare (raggruppa le modifiche ravvicinate). */
  push(immediate = false) {
    if (!this.active || !this.getState) return
    clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => void this.send(), immediate ? 0 : 150)
  }

  private async send() {
    if (!this.active || !this.getState) return
    if (this.sending) {
      this.pending = true
      return
    }
    this.sending = true
    try {
      const { state, logos } = splitLogos(this.getState())
      const update: LiveUpdate = {
        protocol: LIVE_PROTOCOL,
        appVersion: __APP_VERSION__,
        sentAt: now(),
        state,
        viewerLanguage: this.settings.language,
      }
      const res = await this.request('/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      if (res.status === 401) {
        throw new StreamingError(
          'La chiave di questo nome non è più valida: registra di nuovo un nome per lo streaming.',
        )
      }
      if (res.status === 413) {
        throw new StreamingError(
          'Dati troppo grandi per lo streaming: prova con loghi più piccoli.',
        )
      }
      if (!res.ok)
        throw new StreamingError('Il servizio online ha risposto con un errore. Riprova.')
      const { missingLogos = [] } = (await res.json().catch(() => ({}))) as {
        missingLogos?: string[]
      }
      for (const hash of missingLogos) {
        if (!logos[hash]) continue
        const r = await this.request(`/logos/${hash}`, { method: 'PUT', body: logos[hash] })
      }
      if (this.active) {
        this.status = 'live'
        this.error = null
        this.retryDelay = 0
      }
    } catch (e) {
      if (!this.active) return
      this.status = 'error'
      this.error =
        e instanceof StreamingError
          ? e.message
          : 'Il servizio online ha risposto con un errore. Riprova.'
      // Nuovo tentativo sempre più distanziato (massimo 30 s).
      this.retryDelay = Math.min(30_000, Math.max(2_000, this.retryDelay * 2))
      clearTimeout(this.pushTimer)
      this.pushTimer = setTimeout(() => void this.send(), this.retryDelay)
    } finally {
      this.sending = false
      if (this.pending) {
        this.pending = false
        this.push(true)
      }
    }
  }
}

export const streaming = new Streaming()
