import type { SoundId } from './sound-events'
import type { TimbreId } from './sound-presets'

/**
 * Suoni sintetizzati con la Web Audio API: niente file da scaricare o
 * licenze da gestire, funzionano offline e pesano zero.
 *
 * Imitano i suoni veri di un palazzetto:
 * - la sirena del gol è una tromba ad aria compressa (accordo grave, che
 *   "sboccia" salendo leggermente di intonazione, timbro d'ottone);
 * - gli altri segnali sono la tromba elettrica del tabellone, aspra e ronzante;
 * - tutto passa da un riverbero che simula l'eco del palazzetto.
 *
 * Ritmo e timbro sono separati: durate e pause di ogni segnale stanno solo in
 * SOUND_RHYTHMS e valgono per tutti i timbri, che cambiano soltanto il colore.
 */

/** Curva di saturazione morbida: dà al suono la "grana" di una tromba vera. */
function saturationCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const curve = new Float32Array(n)
  const norm = Math.tanh(amount)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(amount * x) / norm
  }
  return curve
}

/** Risposta all'impulso di un ambiente grande (rumore che si spegne): l'eco del palazzetto. */
function arenaImpulse(ctx: BaseAudioContext, seconds = 2.6): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.floor(rate * seconds)
  const buffer = ctx.createBuffer(2, length, rate)
  const preDelay = Math.floor(rate * 0.025)
  // Generatore pseudo-casuale fisso: il riverbero suona sempre uguale.
  let seed = 12345
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    let low = 0
    for (let i = preDelay; i < length; i++) {
      const t = (i - preDelay) / (length - preDelay)
      // Le alte frequenze si spengono prima (pareti e ghiaccio le assorbono)
      low += (random() * 2 - 1 - low) * (0.55 - 0.4 * t)
      data[i] = low * (1 - t) ** 3.2
    }
  }
  return buffer
}

/** Catena d'uscita condivisa (suono diretto + riverbero), una per contesto audio. */
const chains = new WeakMap<BaseAudioContext, Map<AudioNode, AudioNode>>()

function arenaInput(ctx: BaseAudioContext, out: AudioNode): AudioNode {
  let byOut = chains.get(ctx)
  if (!byOut) chains.set(ctx, (byOut = new Map()))
  const existing = byOut.get(out)
  if (existing) return existing

  const input = ctx.createGain()
  const dry = ctx.createGain()
  dry.gain.value = 0.85
  const reverb = ctx.createConvolver()
  reverb.buffer = arenaImpulse(ctx)
  const wet = ctx.createGain()
  wet.gain.value = 0.32
  input.connect(dry).connect(out)
  input.connect(reverb).connect(wet).connect(out)
  byOut.set(out, input)
  return input
}

/** Colore del suono. Non contiene tempi: quelli stanno in ENVELOPES e SOUND_RHYTHMS. */
interface Tone {
  /** Note suonate insieme (Hz). */
  freqs: number[]
  /** Peso di ogni nota (mancante = 1). */
  weights?: number[]
  gain: number
  /** Forma d'onda standard, se non c'è `wave`. */
  type?: OscillatorType
  /** Ampiezza delle armoniche (dalla fondamentale in su): ha la precedenza su `type`. */
  wave?: number[]
  /** Di quanto parte calante l'intonazione (cent) prima di assestarsi. */
  pitchBloom: number
  /** Saturazione: più alta = più aspro. */
  drive: number
  /** Saturazione di ogni singola nota, prima di sommarle: suono più "d'ottone". */
  voiceDrive?: number
  /** Scostamento delle due voci di ogni nota (cent, mancante = 6); 0 = una voce sola. */
  spread?: number
  /** Risonanze del corpo della tromba: [frequenza, guadagno dB, Q]. */
  formants: [number, number, number][]
  cutoff: number
  /** Modulazione di volume (Hz, 0 = nessuna): il ronzio della tromba elettrica. */
  buzz?: number
  /** Profondità della modulazione (mancante = 0,25). */
  buzzDepth?: number
}

type SignalKind = 'goal' | 'signal'

/** Attacco e rilascio (s): uguali per tutti i timbri, così le pause restano identiche. */
const ENVELOPES: Record<SignalKind, { attack: number; release: number }> = {
  goal: { attack: 0.12, release: 0.55 },
  signal: { attack: 0.02, release: 0.12 },
}

/** Ritmo di ogni segnale: `count` colpi lunghi `length` secondi, separati da `gap` secondi. */
export const SOUND_RHYTHMS: Record<
  SoundId,
  { kind: SignalKind; count: number; length: number; gap: number }
> = {
  goal: { kind: 'goal', count: 1, length: 4, gap: 0 },
  periodEnd: { kind: 'signal', count: 1, length: 2.6, gap: 0 },
  timeout: { kind: 'signal', count: 2, length: 0.45, gap: 0.25 },
  timeoutEnd: { kind: 'signal', count: 1, length: 1.1, gap: 0 },
  intermissionEnd: { kind: 'signal', count: 3, length: 0.35, gap: 0.2 },
  shiftChange: { kind: 'signal', count: 1, length: 1.2, gap: 0 },
}

/** Tromba ad aria con le armoniche di una tromba compressa e un leggero tremolio dell'aria. */
function airHorn(freqs: number[], gain: number): Tone {
  return {
    freqs,
    weights: [1, 0.85, 0.7],
    gain,
    wave: [1, 0.5, 0.3],
    pitchBloom: 85,
    drive: 0.5,
    voiceDrive: 3.6,
    spread: 0,
    formants: [],
    cutoff: 9000,
    buzz: 5.5,
    buzzDepth: 0.04,
  }
}

/** Armoniche di una tromba d'ottone: molte, e che calano piano. */
const BRASS_WAVE = [1, 0.85, 0.7, 0.55, 0.42, 0.3, 0.2, 0.13, 0.08]

/** Timbri disponibili: per ognuno il colore della sirena del gol e quello degli altri segnali. */
export const TIMBRES: Record<TimbreId, Record<SignalKind, Tone>> = {
  synth: {
    goal: {
      // Accordo grave (Mi♭ maggiore) con l'ottava sotto: pieno e potente
      freqs: [77.8, 155.6, 196, 233.1],
      gain: 0.5,
      type: 'sawtooth',
      pitchBloom: 90,
      drive: 2.2,
      formants: [
        [180, 4, 0.8],
        [650, 7, 1.4],
        [1500, 5, 1.8],
        [2800, -4, 1],
      ],
      cutoff: 4200,
    },
    signal: {
      freqs: [233.1, 293.7],
      gain: 0.42,
      type: 'square',
      pitchBloom: 30,
      drive: 3.5,
      formants: [
        [500, 3, 1.2],
        [1250, 8, 2],
        [2600, 4, 2.5],
      ],
      cutoff: 5200,
      buzz: 100,
    },
  },
  'air-horn-classic': {
    goal: airHorn([155.6, 196, 233.1], 0.82),
    signal: airHorn([155.6, 196, 233.1], 0.5),
  },
  // Sirena grande e pulita, come si sente nelle dirette televisive
  'tv-horn': {
    goal: {
      freqs: [87.3, 110, 130.8, 174.6],
      gain: 0.55,
      wave: [1, 0.7, 0.55, 0.4, 0.3, 0.2, 0.15, 0.1],
      pitchBloom: 60,
      drive: 1.2,
      voiceDrive: 2,
      spread: 4,
      formants: [
        [220, 5, 0.9],
        [900, 6, 1.2],
        [2200, 3, 1.5],
      ],
      cutoff: 3600,
    },
    signal: {
      freqs: [185, 233.1],
      gain: 0.42,
      type: 'sawtooth',
      pitchBloom: 15,
      drive: 2,
      formants: [
        [400, 4, 1],
        [1100, 6, 1.6],
      ],
      cutoff: 3000,
      buzz: 120,
      buzzDepth: 0.12,
    },
  },
  // Accordo di trombe vere, in sezione
  'brass-horn': {
    goal: {
      freqs: [233.1, 293.7, 349.2, 466.2],
      gain: 0.62,
      wave: BRASS_WAVE,
      pitchBloom: 45,
      drive: 0.8,
      spread: 3,
      formants: [
        [1200, 7, 1.1],
        [2500, 4, 1.6],
      ],
      cutoff: 6000,
    },
    signal: {
      freqs: [233.1, 349.2],
      gain: 0.42,
      wave: BRASS_WAVE,
      pitchBloom: 25,
      drive: 0.8,
      spread: 3,
      formants: [
        [1200, 7, 1.1],
        [2500, 4, 1.6],
      ],
      cutoff: 6000,
    },
  },
}

/** Un colpo di tromba: finisce esattamente a `start + duration`, qualunque sia il timbro. */
function horn(
  ctx: BaseAudioContext,
  out: AudioNode,
  tone: Tone,
  { attack, release }: { attack: number; release: number },
  start: number,
  duration: number,
): number {
  const end = start + duration
  const spread = tone.spread ?? 6
  const spreads = spread === 0 ? [0] : [-spread, spread]

  // Somma delle voci → saturazione → risonanze → filtro → inviluppo
  const sum = ctx.createGain()
  sum.gain.value = 0.9 / Math.sqrt(tone.freqs.length * spreads.length)

  const shaper = ctx.createWaveShaper()
  shaper.curve = saturationCurve(tone.drive)
  shaper.oversample = '4x'

  let node: AudioNode = sum.connect(shaper)
  for (const [freq, db, q] of tone.formants) {
    const f = ctx.createBiquadFilter()
    f.type = 'peaking'
    f.frequency.value = freq
    f.gain.value = db
    f.Q.value = q
    node = node.connect(f)
  }
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = tone.cutoff
  lowpass.Q.value = 0.7
  node = node.connect(lowpass)

  // Ronzio: modulazione d'ampiezza veloce, come la membrana di una tromba elettrica
  if (tone.buzz) {
    const amount = tone.buzzDepth ?? 0.25
    const am = ctx.createGain()
    am.gain.value = 1 - amount
    const lfo = ctx.createOscillator()
    lfo.type = 'triangle'
    lfo.frequency.value = tone.buzz
    const depth = ctx.createGain()
    depth.gain.value = amount
    lfo.connect(depth).connect(am.gain)
    lfo.start(start)
    lfo.stop(end)
    node = node.connect(am)
  }

  const env = ctx.createGain()
  env.gain.setValueAtTime(0, start)
  env.gain.linearRampToValueAtTime(tone.gain * 0.75, start + attack)
  // Piccolo "gonfiarsi" dopo l'attacco, poi tenuta
  env.gain.linearRampToValueAtTime(tone.gain, start + attack * 2.5)
  env.gain.setValueAtTime(tone.gain, Math.max(start + attack * 2.5, end - release))
  env.gain.exponentialRampToValueAtTime(0.0001, end)
  node.connect(env).connect(out)

  // Leggera instabilità dell'intonazione (aria/membrana): rende il suono vivo
  const wobble = ctx.createOscillator()
  wobble.frequency.value = 5.3
  const wobbleDepth = ctx.createGain()
  wobbleDepth.gain.value = 3 // cent
  wobble.connect(wobbleDepth)
  wobble.start(start)
  wobble.stop(end)

  const wave = tone.wave
    ? ctx.createPeriodicWave(
        new Float32Array(tone.wave.length + 1),
        new Float32Array([0, ...tone.wave]),
      )
    : null
  const voiceCurve = tone.voiceDrive ? saturationCurve(tone.voiceDrive) : null

  tone.freqs.forEach((freq, i) => {
    const voice = ctx.createGain()
    voice.gain.value = tone.weights?.[i] ?? 1
    let input: AudioNode = voice
    if (voiceCurve) {
      const voiceShaper = ctx.createWaveShaper()
      voiceShaper.curve = voiceCurve
      voiceShaper.oversample = '4x'
      voiceShaper.connect(voice)
      input = voiceShaper
    }
    voice.connect(sum)
    for (const cents of spreads) {
      const osc = ctx.createOscillator()
      if (wave) osc.setPeriodicWave(wave)
      else osc.type = tone.type ?? 'sawtooth'
      osc.frequency.value = freq
      // L'intonazione parte un po' calante e sale: il tipico "sbocciare" della tromba
      osc.detune.setValueAtTime(cents - tone.pitchBloom, start)
      osc.detune.setTargetAtTime(cents, start, attack * 0.8)
      wobbleDepth.connect(osc.detune)
      osc.connect(input)
      osc.start(start)
      osc.stop(end)
    }
  })
  return end
}

/** Programma il suono `id` a partire dall'istante `at`; restituisce quando finisce. */
export function scheduleSound(
  ctx: BaseAudioContext,
  out: AudioNode,
  id: SoundId,
  at: number,
  timbre: TimbreId = 'synth',
): number {
  const arena = arenaInput(ctx, out)
  const { kind, count, length, gap } = SOUND_RHYTHMS[id]
  const tone = TIMBRES[timbre][kind]
  let end = at
  for (let i = 0; i < count; i++) {
    end = horn(ctx, arena, tone, ENVELOPES[kind], at + i * (length + gap), length)
  }
  return end
}
