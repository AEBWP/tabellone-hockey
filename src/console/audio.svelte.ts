import { SOUND_IDS, type SoundId } from './sound-events'
import { deleteSound, loadSound, saveSound } from './sound-store'
import { scheduleSound } from './synth'
import type { SoundSource } from './sound-presets'
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
  /** Suoni sostituiti da un file dell'operatore: nome del file. */
  custom: Partial<Record<SoundId, string>>
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
}

function loadSettings(): AudioSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<AudioSettings>
    if (!saved || typeof saved !== 'object') return structuredClone(DEFAULT_AUDIO)
    return {
      ...DEFAULT_AUDIO,
      ...saved,
      enabled: { ...DEFAULT_AUDIO.enabled, ...saved.enabled },
      custom: { ...saved.custom },
    }
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
  /** Suoni personalizzati già decodificati, pronti da suonare. */
  private buffers = new Map<SoundId, AudioBuffer>()
  /** Ultima riproduzione di ogni file: riprovando, la precedente si ferma. */
  private playing = new Map<SoundId, AudioBufferSourceNode>()

  /** Quanto far passare prima della musica, per non coprire la sirena di fine periodo. */
  get periodEndWaitMs(): number {
    if (this.settings.muted || !this.settings.enabled.periodEnd) return 0
    return ((this.buffers.get('periodEnd')?.duration ?? 2.6) + 0.4) * 1000
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
    void this.loadCustomSounds()
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
    const buffer = this.buffers.get(id)
    if (!buffer) {
      scheduleSound(ctx, this.master!, id, at)
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
    this.buffers.set(id, buffer)
    this.update({ custom: { ...this.settings.custom, [id]: file.name } })
  }

  // STUB da scartare al merge: l'implementazione vera è in claude/sirene-logica.
  sourceOf(id: SoundId): SoundSource {
    return this.settings.custom[id] ? 'custom' : 'synth'
  }

  // STUB da scartare al merge: l'implementazione vera è in claude/sirene-logica.
  async setSource(id: SoundId, source: SoundSource): Promise<void> {
    void id
    void source
  }

  /** Torna al suono sintetizzato. */
  async removeCustom(id: SoundId): Promise<void> {
    this.playing.get(id)?.stop()
    this.buffers.delete(id)
    const custom = { ...this.settings.custom }
    delete custom[id]
    this.update({ custom })
    await deleteSound(id).catch(() => {})
  }

  private async loadCustomSounds() {
    const ctx = this.ctx!
    for (const id of Object.keys(this.settings.custom) as SoundId[]) {
      try {
        const stored = await loadSound(id)
        if (stored) this.buffers.set(id, await ctx.decodeAudioData(stored.data.slice(0)))
      } catch {
        // File non più leggibile: si usa il suono sintetizzato.
      }
    }
  }

  /** Prova un suono dalle impostazioni (suona anche se è disattivato). */
  test(id: SoundId) {
    this.unlock()
    const wasMuted = this.settings.muted
    if (wasMuted) this.applyVolume(true)
    this.play(id, true)
    const seconds = this.buffers.get(id)?.duration ?? 4
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
