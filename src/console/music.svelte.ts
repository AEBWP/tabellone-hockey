import { desktop } from '../shared/desktop'
import { audio } from './audio.svelte'
import {
  cleanMusicSettings,
  isAudioFile,
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
const FADE_OUT_MS = 2_500
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
  /** Solo nel browser, dove il percorso dei file non è disponibile: valgono fino alla chiusura. */
  private sessionFiles = new Map<string, File>()
  private sink: string | null = null
  /** Dissolvenza in corso: 0–1, moltiplica il volume. */
  private level = 0
  private fade: ReturnType<typeof setInterval> | undefined
  private waiting: ReturnType<typeof setTimeout> | undefined
  /** Cresce a ogni cambio: chi era in attesa capisce di essere stato superato. */
  private token = 0
  private starting = false

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

  /** La prossima traccia, quando si può sapere in anticipo. */
  get nextId(): string | null {
    return this.settings.shuffle ? null : (pickNext(this.settings, this.missing)?.id ?? null)
  }

  /** Rilegge quali file ci sono: all'avvio, aprendo la scheda e prima di ogni partenza. */
  async check() {
    const { tracks } = this.settings
    const paths = tracks.flatMap((t) => (t.path ? [t.path] : []))
    const found = desktop && paths.length ? await desktop.checkFiles(paths).catch(() => []) : []
    const reachable = new Set(paths.filter((_, i) => found[i]))
    this.missing = new Set(
      tracks
        .filter((t) => (t.path ? !reachable.has(t.path) : !this.sessionFiles.has(t.id)))
        .map((t) => t.id),
    )
  }

  /** Evento della partita. `waitMs`: quanto dura la sirena da lasciar finire. */
  handle(event: MusicEvent, waitMs: number) {
    clearTimeout(this.waiting)
    if (event === 'stop') {
      this.stop()
      return
    }
    if (!this.settings.enabled || !this.settings.tracks.length) return
    this.waiting = setTimeout(
      () => {
        if (!this.current) void this.begin()
      },
      Math.min(waitMs, MAX_WAIT_MS),
    )
  }

  /** Musica negli intervalli sì o no. Spegnendola, quella in corso sfuma. */
  setEnabled(enabled: boolean) {
    this.update({ enabled })
    if (!enabled) this.stop()
  }

  /** Avvio a mano. */
  play() {
    audio.unlock()
    clearTimeout(this.waiting)
    if (!this.current) void this.begin()
  }

  /** Passa alla traccia successiva, senza dissolvenza. */
  skip() {
    if (this.current) void this.playNext()
  }

  /** Sfuma e si ferma. La traccia interrotta non verrà ripresa. */
  stop() {
    clearTimeout(this.waiting)
    if (this.current) this.fadeTo(0, FADE_OUT_MS, () => this.halt())
    else this.token++
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
        if (!path) this.sessionFiles.set(known.id, file)
        continue
      }
      try {
        const seconds = await probe(file)
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
        if (!path) this.sessionFiles.set(id, file)
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

  move(id: string, delta: -1 | 1) {
    const tracks = [...this.settings.tracks]
    const from = tracks.findIndex((t) => t.id === id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= tracks.length) return
    ;[tracks[from], tracks[to]] = [tracks[to], tracks[from]]
    this.update({ tracks })
  }

  clear() {
    this.halt()
    this.sessionFiles.clear()
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
