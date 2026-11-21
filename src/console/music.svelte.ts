import { desktop } from '../shared/desktop'
import { audio } from './audio.svelte'
import { clearTracks, deleteTrack, loadTrack, saveTrack } from './track-store'
import {
  cleanMusicSettings,
  isAudioFile,
  PAUSE_DELAY_MS,
  pickNext,
  type MusicEvent,
  type MusicSettings,
  type MusicTrack,
} from './music'

/**
 * Tracce audio degli intervalli. La playlist contiene solo i riferimenti ai file:
 * se un file sparisce (chiavetta tolta, cartella spostata) la traccia viene
 * segnalata e saltata, e torna buona da sola appena il file è di nuovo lì.
 *
 * Usa un elemento <audio> e non i suoni della console: una traccia intera
 * decodificata in memoria peserebbe decine di MB. Volume, silenzio e uscita sono
 * però gli stessi delle sirene.
 */

const SETTINGS_KEY = 'tabellone-hockey:musica:v1'
const FADE_IN_MS = 1_500
/** Quando il tempo riparte si deve giocare: stop quasi istantaneo (solo per evitare lo schiocco). */
const QUICK_STOP_MS = 150
/** Una sirena registrata può durare molto: la musica non aspetta più di così. */
const MAX_WAIT_MS = 8_000

type SinkAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }

function loadSettings(): MusicSettings {
  try {
    return cleanMusicSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null'))
  } catch {
    return cleanMusicSettings(null)
  }
}

/** Controlla che il file si possa suonare e ne legge la durata. */
function probe(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const el = new Audio()
    const done = (fn: () => void) => {
      URL.revokeObjectURL(url)
      el.onloadedmetadata = el.onerror = null
      fn()
    }
    el.preload = 'metadata'
    el.onloadedmetadata = () => done(() => resolve(Number.isFinite(el.duration) ? el.duration : 0))
    el.onerror = () => done(() => reject(new Error('formato')))
    el.src = url
  })
}

class MusicPlayer {
  settings = $state<MusicSettings>(loadSettings())
  current = $state<MusicTrack | null>(null)
  error = $state<string | null>(null)
  /** Tracce il cui file non si trova. */
  missing = $state<ReadonlySet<string>>(new Set())

  private el: SinkAudio | null = null
  private objectUrl: string | null = null
  /** Solo nel browser, dove il percorso dei file non è disponibile: copia in archivio interno (track-store). */
  private sessionFiles = new Map<string, File>()
  private sink: string | null = null
  /** Dissolvenza in corso: 0–1, moltiplica il volume. */
  private level = 0
  private fade: ReturnType<typeof setInterval> | undefined
  private waiting: ReturnType<typeof setTimeout> | undefined
  /** Musica in arrivo (attesa dei 2 secondi): per il feedback subito, prima che parta l'audio. */
  pending = $state(false)
  /** Cresce a ogni cambio: chi era in attesa capisce di essere stato superato. */
  private token = 0
  private starting = false
  /** Traccia ferma a metà perché il tempo è ripartito: alla prossima pausa continua da lì. */
  paused = $state(false)

  constructor() {
    // Volume, silenzio e uscita seguono le impostazioni anche a traccia iniziata.
    $effect.root(() => {
      $effect(() => {
        this.applyVolume()
        this.applyOutput()
      })
    })
    void this.check()
  }

  /** La musica è in corso o sta per partire: serve alla scheda per accendersi subito. */
  get active(): boolean {
    return this.pending || (!!this.current && !this.paused)
  }

  private cancelWait() {
    clearTimeout(this.waiting)
    this.pending = false
  }

  /** Rilegge quali file ci sono: all'avvio, aprendo la scheda e prima di ogni partenza. */
  async check() {
    const { tracks } = this.settings
    // Nel browser i file non hanno percorso: si riprendono dall'archivio interno.
    for (const track of tracks) {
      if (track.path || this.sessionFiles.has(track.id)) continue
      const stored = await loadTrack(track.id).catch(() => undefined)
      if (stored) {
        this.sessionFiles.set(track.id, new File([stored], track.name, { type: stored.type }))
      }
    }
    const paths = tracks.flatMap((t) => (t.path ? [t.path] : []))
    const found = desktop && paths.length ? await desktop.checkFiles(paths).catch(() => []) : []
    const reachable = new Set(paths.filter((_, i) => found[i]))
    this.missing = new Set(
      tracks
        .filter((t) => (t.path ? !reachable.has(t.path) : !this.sessionFiles.has(t.id)))
        .map((t) => t.id),
    )
  }

  /**
   * Evento della partita. `waitMs`: quanto dura la sirena da lasciar finire, per
   * la musica dell'intervallo; a tempo fermo l'attesa è sempre `PAUSE_DELAY_MS`.
   */
  handle(event: MusicEvent, waitMs: number) {
    this.cancelWait()
    // Fine intervallo e tempo che riparte sono uguali: musica ferma subito, e con la
    // spunta "riprendi" la traccia resta a metà per la prossima volta.
    if (event === 'stop' || event === 'resume') {
      this.resume()
      return
    }
    if (!this.settings.enabled || !this.settings.tracks.length) return
    const delay = event === 'pause' ? PAUSE_DELAY_MS : Math.min(waitMs, MAX_WAIT_MS)
    this.pending = true
    this.waiting = setTimeout(() => {
      this.pending = false
      if (this.paused) void this.unpause()
      else if (!this.current) void this.begin()
    }, delay)
  }

  /** Il tempo riparte: la musica si ferma subito, senza attese né lunghe dissolvenze. */
  private resume() {
    if (!this.current || this.paused) {
      if (!this.current) this.token++
      return
    }
    if (this.settings.continueTrack) {
      this.fadeTo(0, QUICK_STOP_MS, () => {
        this.el?.pause()
        this.paused = true
      })
    } else {
      this.fadeTo(0, QUICK_STOP_MS, () => this.halt())
    }
  }

  /** Riprende la traccia fermata dal tempo che ripartiva, dal punto in cui era. */
  private async unpause() {
    const el = this.el
    if (!el || !this.current) {
      this.paused = false
      return void this.begin()
    }
    this.paused = false
    this.starting = true
    try {
      await el.play()
      this.fadeTo(1, FADE_IN_MS)
    } catch {
      this.halt()
      void this.begin()
    } finally {
      this.starting = false
    }
  }

  /** Musica negli intervalli sì o no. Spegnendola, quella in corso si ferma subito. */
  setEnabled(enabled: boolean) {
    this.update({ enabled })
    if (!enabled) this.stop()
  }

  /** Avvio a mano (scheda Musica), per esempio nell'attesa prima della partita. */
  play() {
    if (!this.settings.enabled || !this.settings.tracks.length) return
    audio.unlock()
    this.cancelWait()
    if (this.paused) void this.unpause()
    else if (!this.current) void this.begin()
  }

  /** Suona proprio questa traccia, anche se è già stata suonata in questo giro. */
  async playTrack(id: string) {
    const track = this.settings.tracks.find((t) => t.id === id)
    if (!track || !this.settings.enabled) return
    audio.unlock()
    this.cancelWait()
    const token = ++this.token
    this.paused = false
    this.error = null
    await this.check()
    if (token !== this.token) return
    clearInterval(this.fade)
    this.level = 0
    this.applyVolume()
    const { played } = this.settings
    this.update({ lastId: id, played: played.includes(id) ? played : [...played, id] })
    if (await this.startTrack(track)) {
      if (token === this.token) this.fadeTo(1, FADE_IN_MS)
      return
    }
    if (token !== this.token) return
    this.missing = new Set([...this.missing, id])
    this.halt()
    this.error = 'Nessuna traccia raggiungibile: controlla i file della playlist.'
  }

  /** Passa alla traccia successiva, senza dissolvenza. */
  skip() {
    if (this.current) void this.playNext()
  }

  /** Nuova partita: si ferma subito e niente della partita precedente viene ripreso. */
  reset() {
    this.cancelWait()
    this.halt()
    // Tabula rasa: la nuova partita sceglie a caso tra tutte, senza tener conto delle già suonate.
    this.update({ lastId: null, played: [] })
  }

  /** Ferma subito, senza dissolvenza. La traccia interrotta non verrà ripresa. */
  stop() {
    this.cancelWait()
    this.halt()
  }

  private async begin() {
    const token = ++this.token
    this.error = null
    await this.check()
    if (token !== this.token) return
    clearInterval(this.fade)
    this.level = 0
    this.applyVolume()
    if (await this.playNext()) this.fadeTo(1, FADE_IN_MS)
  }

  /** Fa partire la traccia successiva; se una non si riesce a suonare passa all'altra. */
  private async playNext(): Promise<boolean> {
    const token = ++this.token
    for (let i = 0; i < this.settings.tracks.length; i++) {
      const next = pickNext(this.settings, this.missing)
      const track = this.settings.tracks.find((t) => t.id === next?.id)
      if (!next || !track) break
      // Si segna subito: anche se viene interrotta, la prossima volta se ne sente un'altra.
      this.update({ lastId: next.id, played: next.played })
      const ok = await this.startTrack(track)
      if (token !== this.token) return false
      if (ok) return true
      this.missing = new Set([...this.missing, track.id])
    }
    this.halt()
    this.error = 'Nessuna traccia raggiungibile: controlla i file della playlist.'
    return false
  }

  private async startTrack(track: MusicTrack): Promise<boolean> {
    const file = this.sessionFiles.get(track.id)
    if (!track.path && !file) return false
    const el = this.ensureElement()
    this.releaseUrl()
    if (track.path) el.src = `tabellone-audio://file/${encodeURIComponent(track.path)}`
    else el.src = this.objectUrl = URL.createObjectURL(file!)
    this.starting = true
    try {
      await el.play()
      this.current = track
      return true
    } catch {
      return false
    } finally {
      this.starting = false
    }
  }

  private ensureElement(): SinkAudio {
    if (this.el) return this.el
    const el: SinkAudio = new Audio()
    el.onended = () => void this.playNext()
    // File tolto o rovinato mentre suona: si va avanti. Se invece non parte, ci pensa playNext.
    el.onerror = () => {
      if (this.starting || !this.current) return
      this.missing = new Set([...this.missing, this.current.id])
      void this.playNext()
    }
    this.el = el
    this.applyVolume()
    this.applyOutput()
    return el
  }

  private releaseUrl() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.objectUrl = null
  }

  private halt() {
    this.token++
    this.paused = false
    clearInterval(this.fade)
    this.level = 0
    this.current = null
    if (this.el) {
      this.el.pause()
      this.el.removeAttribute('src')
      this.el.load()
    }
    this.releaseUrl()
  }

  private fadeTo(target: number, ms: number, done?: () => void) {
    clearInterval(this.fade)
    const from = this.level
    const started = performance.now()
    this.fade = setInterval(() => {
      const p = Math.min(1, (performance.now() - started) / ms)
      this.level = from + (target - from) * p
      this.applyVolume()
      if (p < 1) return
      clearInterval(this.fade)
      done?.()
    }, 40)
  }

  private applyVolume() {
    const { muted, volume } = audio.settings
    const own = this.settings.volume
    if (!this.el) return
    // Stessa curva delle sirene: più naturale per l'orecchio.
    const general = muted ? 0 : (volume / 100) ** 2
    this.el.volume = Math.min(1, general * (own / 100) ** 2 * this.level)
  }

  private applyOutput() {
    const id = audio.settings.outputId
    if (!this.el?.setSinkId || this.sink === id) return
    this.sink = id
    this.el.setSinkId(id).catch(() => {
      // Uscita non disponibile: l'errore lo mostrano già le impostazioni audio.
    })
  }

  /** Aggiunge i riferimenti ai file. Restituisce quanti ne ha presi e quali ha scartato. */
  async add(files: File[]): Promise<{ added: number; rejected: string[] }> {
    const { tracks } = this.settings
    const added: MusicTrack[] = []
    const rejected: string[] = []
    const candidates = files
      .filter(isAudioFile)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    for (const file of candidates) {
      const path = desktop?.filePath(file) || null
      const known = [...tracks, ...added].find((t) =>
        path ? t.path === path : !t.path && t.name === file.name,
      )
      if (known) {
        // Già in elenco. Nel browser il file va ridato a ogni apertura: si riaggancia.
        if (!path) {
          this.sessionFiles.set(known.id, file)
          void saveTrack(known.id, file).catch(() => {})
        }
        continue
      }
      try {
        const seconds = await probe(file)
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
        if (!path) {
          this.sessionFiles.set(id, file)
          void saveTrack(id, file).catch(() => {})
        }
        added.push({ id, name: file.name, path, seconds })
      } catch {
        rejected.push(file.name)
      }
    }
    if (added.length) this.update({ tracks: [...tracks, ...added] })
    await this.check()
    return { added: added.length, rejected }
  }

  remove(id: string) {
    const { tracks, lastId } = this.settings
    const index = tracks.findIndex((t) => t.id === id)
    if (index < 0) return
    this.sessionFiles.delete(id)
    void deleteTrack(id).catch(() => {})
    this.update({
      tracks: tracks.filter((t) => t.id !== id),
      // Togliendo l'ultima partita, l'ordine prosegue dal punto in cui era.
      lastId: lastId === id ? (tracks[index - 1]?.id ?? null) : lastId,
      played: this.settings.played.filter((p) => p !== id),
    })
    if (this.current?.id === id) {
      if (this.settings.tracks.length) void this.playNext()
      else this.halt()
    }
  }

  clear() {
    this.halt()
    this.sessionFiles.clear()
    void clearTracks().catch(() => {})
    this.missing = new Set()
    this.update({ tracks: [], lastId: null, played: [] })
  }

  update(patch: Partial<MusicSettings>) {
    this.settings = { ...this.settings, ...patch }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
    } catch {
      // Non critico: le impostazioni restano valide fino alla chiusura.
    }
  }
}

export const music = new MusicPlayer()
