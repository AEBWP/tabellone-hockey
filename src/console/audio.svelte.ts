import { SOUND_IDS, type SoundId } from './sound-events'
import { deleteSound, loadSound, saveSound } from './sound-store'
import { findPreset, type SoundSource } from './sound-presets'
import { fadeOut, holdEnd, holdHorn, scheduleSound, type HeldSound } from './synth'
import { t } from '../i18n/ui.svelte'

/**
 * Audio della console: sirene e segnali, con volume, silenzio e scelta
 * dell'uscita (es. casse del palazzetto o HDMI del maxischermo).
 *
 * I suoni partono dalla console e non dal tabellone: così suonano una volta
 * sola e il browser li permette (la console è la finestra che l'operatore usa).
 */

export interface AudioSettings {
  /** 0–100. */
  volume: number
  muted: boolean
  enabled: Record<SoundId, boolean>
  /** Id dell'uscita audio; '' = predefinita del sistema. */
  outputId: string
  /**
   * File caricati dall'operatore: nome del file. Restano salvati anche se il
   * suono passa a un'altra sorgente, così l'operatore può tornarci.
   */
  custom: Partial<Record<SoundId, string>>
  /** Sorgente di ogni suono; mancante = 'synth' (o 'custom' se c'è un file: impostazioni vecchie). */
  source: Partial<Record<SoundId, SoundSource>>
}

/** Dimensione massima di un file audio personalizzato. */
export const MAX_CUSTOM_BYTES = 20 * 1024 * 1024

const SETTINGS_KEY = 'tabellone-hockey:audio:v1'

export const DEFAULT_AUDIO: AudioSettings = {
  volume: 80,
  muted: false,
  enabled: Object.fromEntries(SOUND_IDS.map((id) => [id, true])) as Record<SoundId, boolean>,
  outputId: '',
  custom: {},
  source: {},
}

/**
 * Sorgente effettiva di un suono secondo le impostazioni:
 * - mancante → 'custom' se c'è un file caricato (impostazioni vecchie), altrimenti 'synth';
 * - 'custom' senza file, o un predefinito che non esiste più → 'synth'.
 */
export function resolveSource(
  settings: Pick<AudioSettings, 'custom' | 'source'>,
  id: SoundId,
): SoundSource {
  const hasCustom = !!settings.custom[id]
  const source = settings.source[id]
  if (source === undefined) return hasCustom ? 'custom' : 'synth'
  if (source === 'custom') return hasCustom ? 'custom' : 'synth'
  if (source === 'synth' || !findPreset(source)) return 'synth'
  return source
}

/** Impostazioni salvate (anche di versioni vecchie, o rovinate) → impostazioni valide. */
export function normalizeAudioSettings(saved: unknown): AudioSettings {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    return structuredClone(DEFAULT_AUDIO)
  }
  const s = saved as Partial<AudioSettings>
  const custom: Partial<Record<SoundId, string>> = {}
  for (const id of SOUND_IDS) {
    const name = s.custom?.[id]
    if (typeof name === 'string' && name) custom[id] = name
  }
  const rawSource = s.source && typeof s.source === 'object' ? s.source : {}
  const source: Partial<Record<SoundId, SoundSource>> = {}
  for (const id of SOUND_IDS) {
    const value = rawSource[id]
    const resolved = resolveSource(
      { custom, source: typeof value === 'string' ? { [id]: value } : {} },
      id,
    )
    if (resolved !== 'synth') source[id] = resolved
  }
  return {
    ...DEFAULT_AUDIO,
    ...s,
    enabled: { ...DEFAULT_AUDIO.enabled, ...s.enabled },
    custom,
    source,
  }
}

function loadSettings(): AudioSettings {
  try {
    return normalizeAudioSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null'))
  } catch {
    return structuredClone(DEFAULT_AUDIO)
  }
}

type SinkContext = AudioContext & { setSinkId?: (id: string) => Promise<void> }

export interface OutputDevice {
  id: string
  label: string
}

class AudioEngine {
  settings = $state<AudioSettings>(loadSettings())
  /** False finché il browser non permette di suonare (serve un clic o un tasto). */
  unlocked = $state(false)
  outputs = $state<OutputDevice[]>([])
  outputError = $state<string | null>(null)

  private ctx: SinkContext | null = null
  private master: GainNode | null = null
  /** File dell'operatore già decodificati, pronti da suonare. */
  private customBuffers = new Map<SoundId, AudioBuffer>()
  /** Ultima riproduzione di ogni file: riprovando, la precedente si ferma. */
  private playing = new Map<SoundId, AudioBufferSourceNode>()
  /** Tromba manuale che sta suonando (tasto ancora premuto). */
  private held: HeldSound | null = null

  /** Quanto far passare prima della musica, per non coprire la sirena di fine periodo. */
  get periodEndWaitMs(): number {
    if (this.settings.muted || !this.settings.enabled.periodEnd) return 0
    return ((this.bufferFor('periodEnd')?.duration ?? 2.6) + 0.4) * 1000
  }

  /** Sorgente attiva di un suono: 'synth', 'custom' o l'id di un predefinito. */
  sourceOf(id: SoundId): SoundSource {
    return resolveSource(this.settings, id)
  }

  /** File dell'operatore da suonare; undefined = suono sintetizzato (o file non ancora pronto/illeggibile). */
  private bufferFor(id: SoundId): AudioBuffer | undefined {
    return this.sourceOf(id) === 'custom' ? this.customBuffers.get(id) : undefined
  }

  /** Il browser permette di scegliere l'uscita audio? (Chrome/Edge recenti ed Electron sì) */
  get canChooseOutput(): boolean {
    return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype
  }

  private ensureContext(): SinkContext {
    if (this.ctx) return this.ctx
    const ctx: SinkContext = new AudioContext({ latencyHint: 'interactive' })
    // Compressore: anche con più suoni insieme non si distorce.
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -12
    compressor.ratio.value = 6
    const master = ctx.createGain()
    master.connect(compressor).connect(ctx.destination)
    this.ctx = ctx
    this.master = master
    this.applyVolume()
    ctx.onstatechange = () => (this.unlocked = ctx.state === 'running')
    if (this.settings.outputId) void this.setOutput(this.settings.outputId)
    void this.loadActiveSounds()
    return ctx
  }

  /** Da chiamare a ogni interazione dell'operatore: sblocca l'audio se il browser lo teneva in pausa. */
  unlock() {
    const ctx = this.ensureContext()
    if (ctx.state !== 'running') void ctx.resume()
    else this.unlocked = true
  }

  play(id: SoundId, force = false) {
    if (!force && (this.settings.muted || !this.settings.enabled[id])) return
    const ctx = this.ensureContext()
    if (ctx.state !== 'running') void ctx.resume()
    const at = ctx.currentTime + 0.02
    const buffer = this.bufferFor(id)
    if (!buffer) {
      scheduleSound(ctx, this.master!, id, at, findPreset(this.sourceOf(id))?.id)
      return
    }
    this.playing.get(id)?.stop()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.master!)
    source.onended = () => {
      if (this.playing.get(id) === source) this.playing.delete(id)
    }
    source.start(at)
    this.playing.set(id, source)
  }

  /**
   * Tromba manuale: inizia a suonare e va avanti fino a `hornUp`, per tutto il
   * tempo in cui l'operatore tiene premuto. False se l'audio è spento o la
   * tromba è disattivata (e allora non suona).
   */
  hornDown(force = false): boolean {
    if (!force && (this.settings.muted || !this.settings.enabled.horn)) return false
    this.hornUp()
    const ctx = this.ensureContext()
    if (ctx.state !== 'running') void ctx.resume()
    const at = ctx.currentTime + 0.005
    const buffer = this.bufferFor('horn')
    this.held = buffer
      ? this.holdBuffer(ctx, buffer, at)
      : holdHorn(ctx, this.master!, at, findPreset(this.sourceOf('horn'))?.id)
    return true
  }

  /** Tasto della tromba rilasciato: il suono smette subito. */
  hornUp() {
    this.held?.release()
    this.held = null
  }

  /** File dell'operatore suonato a ripetizione finché non viene rilasciato. */
  private holdBuffer(ctx: AudioContext, buffer: AudioBuffer, at: number): HeldSound {
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(1, at + 0.01)
    source.connect(env).connect(this.master!)
    source.onended = () => env.disconnect()
    source.start(at)
    let released = false
    return {
      release() {
        if (released) return
        released = true
        source.stop(fadeOut(env.gain, holdEnd(ctx, at)))
      },
    }
  }

  /**
   * Sceglie la sorgente di un suono. Un file caricato viene decodificato prima
   * di cambiare: se non riesce lancia un Error e la sorgente resta quella di prima.
   */
  async setSource(id: SoundId, source: SoundSource): Promise<void> {
    if (source === 'custom') {
      if (!this.settings.custom[id]) throw new Error('Nessun file caricato per questo suono.')
      try {
        await this.loadCustom(id)
      } catch {
        throw new Error('Impossibile leggere il file caricato: caricalo di nuovo.')
      }
    } else if (source !== 'synth' && !findPreset(source)) {
      throw new Error('Suono predefinito non trovato.')
    }
    if (this.sourceOf(id) !== source) this.playing.get(id)?.stop()
    this.update({ source: { ...this.settings.source, [id]: source } })
  }

  /** Usa un file audio (es. la sirena vera del palazzetto) al posto del suono sintetizzato. */
  async setCustom(id: SoundId, file: File): Promise<void> {
    if (file.size > MAX_CUSTOM_BYTES) {
      throw new Error('Il file è troppo grande (massimo 20 MB): usa un audio più corto.')
    }
    const data = await file.arrayBuffer()
    const ctx = this.ensureContext()
    let buffer: AudioBuffer
    try {
      buffer = await ctx.decodeAudioData(data.slice(0))
    } catch {
      throw new Error('Formato audio non riconosciuto: usa un file MP3, WAV o OGG.')
    }
    await saveSound(id, { name: file.name, data })
    this.playing.get(id)?.stop()
    this.customBuffers.set(id, buffer)
    this.update({
      custom: { ...this.settings.custom, [id]: file.name },
      source: { ...this.settings.source, [id]: 'custom' },
    })
  }

  /** Cancella il file caricato; se era la sorgente attiva torna al suono sintetizzato. */
  async removeCustom(id: SoundId): Promise<void> {
    const wasActive = this.sourceOf(id) === 'custom'
    if (wasActive) this.playing.get(id)?.stop()
    this.customBuffers.delete(id)
    const custom = { ...this.settings.custom }
    delete custom[id]
    const source = { ...this.settings.source }
    if (wasActive || source[id] === 'custom') source[id] = 'synth'
    this.update({ custom, source })
    await deleteSound(id).catch(() => {})
  }

  /** Decodifica il file dell'operatore salvato per un suono (se non è già pronto). */
  private async loadCustom(id: SoundId): Promise<AudioBuffer> {
    const ready = this.customBuffers.get(id)
    if (ready) return ready
    const ctx = this.ensureContext()
    const stored = await loadSound(id)
    if (!stored) throw new Error('File mancante')
    const buffer = await ctx.decodeAudioData(stored.data.slice(0))
    this.customBuffers.set(id, buffer)
    return buffer
  }

  /** All'avvio carica solo i file delle sorgenti in uso; se uno non si carica resta il sintetizzato. */
  private async loadActiveSounds() {
    await Promise.all(
      SOUND_IDS.filter((id) => this.sourceOf(id) === 'custom').map((id) =>
        this.loadCustom(id).catch(() => {
          // File non leggibile: per questo suono si usa il sintetizzato.
        }),
      ),
    )
  }

  /** Prova un suono dalle impostazioni (suona anche se è disattivato). */
  test(id: SoundId) {
    this.unlock()
    const wasMuted = this.settings.muted
    if (wasMuted) this.applyVolume(true)
    let seconds = this.bufferFor(id)?.duration ?? 4
    if (id === 'horn') {
      // La tromba manuale non ha una durata sua: in prova si sente per un secondo.
      seconds = 1
      this.hornDown(true)
      const mine = this.held
      setTimeout(() => this.held === mine && this.hornUp(), seconds * 1000)
    } else {
      this.play(id, true)
    }
    if (wasMuted) setTimeout(() => this.applyVolume(), (seconds + 0.5) * 1000)
  }

  update(patch: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...patch }
    this.applyVolume()
    this.save()
  }

  toggleMute() {
    this.update({ muted: !this.settings.muted })
  }

  setEnabled(id: SoundId, on: boolean) {
    this.update({ enabled: { ...this.settings.enabled, [id]: on } })
  }

  async refreshOutputs() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const outputs = devices.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default')
      this.outputs = outputs.map((d, i) => ({
        id: d.deviceId,
        // Nel browser i nomi possono essere nascosti per privacy; in Electron ci sono.
        label: d.label || t('Uscita audio {n}', { n: i + 1 }),
      }))
    } catch {
      this.outputs = []
    }
  }

  async setOutput(id: string) {
    this.outputError = null
    this.update({ outputId: id })
    const ctx = this.ctx
    if (!ctx?.setSinkId) return
    try {
      await ctx.setSinkId(id)
    } catch {
      this.outputError = 'Impossibile usare questa uscita: torno a quella predefinita.'
      this.update({ outputId: '' })
      await ctx.setSinkId('').catch(() => {})
    }
  }

  private applyVolume(forceAudible = false) {
    if (!this.master || !this.ctx) return
    const muted = this.settings.muted && !forceAudible
    const v = muted ? 0 : (this.settings.volume / 100) ** 2 // curva più naturale per l'orecchio
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02)
  }

  private save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
    } catch {
      // Non critico: le impostazioni audio restano valide fino alla chiusura.
    }
  }
}

export const audio = new AudioEngine()
