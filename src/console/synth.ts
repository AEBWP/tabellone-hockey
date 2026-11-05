import type { SoundId } from './sound-events'

/**
 * Suoni sintetizzati con la Web Audio API: niente file da scaricare o
 * licenze da gestire, funzionano offline e pesano zero.
 *
 * Imitano i suoni veri di un palazzetto:
 * - la sirena del gol è una tromba ad aria compressa (accordo grave, che
 *   "sboccia" salendo leggermente di intonazione, timbro d'ottone);
 * - gli altri segnali sono la tromba elettrica del tabellone, aspra e ronzante;
 * - tutto passa da un riverbero che simula l'eco del palazzetto.
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

interface HornOptions {
  /** Note suonate insieme (Hz). */
  freqs: number[]
  start: number
  duration: number
  gain: number
  type: OscillatorType
  /** Tempo per arrivare al pieno volume (s). */
  attack: number
  release: number
  /** Di quanto parte calante l'intonazione (cent) prima di assestarsi. */
  pitchBloom: number
  /** Saturazione: più alta = più aspro. */
  drive: number
  /** Risonanze del corpo della tromba: [frequenza, guadagno dB, Q]. */
  formants: [number, number, number][]
  cutoff: number
  /** Ronzio della tromba elettrica (Hz di modulazione, 0 = nessuno). */
  buzz?: number
}

function horn(ctx: BaseAudioContext, out: AudioNode, o: HornOptions): number {
  const end = o.start + o.duration

  // Somma delle voci → saturazione → risonanze → filtro → inviluppo
  const sum = ctx.createGain()
  sum.gain.value = 0.9 / Math.sqrt(o.freqs.length * 2)

  const shaper = ctx.createWaveShaper()
  shaper.curve = saturationCurve(o.drive)
  shaper.oversample = '4x'

  let node: AudioNode = sum.connect(shaper)
  for (const [freq, db, q] of o.formants) {
    const f = ctx.createBiquadFilter()
    f.type = 'peaking'
    f.frequency.value = freq
    f.gain.value = db
    f.Q.value = q
    node = node.connect(f)
  }
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = o.cutoff
  lowpass.Q.value = 0.7
  node = node.connect(lowpass)

  // Ronzio: modulazione d'ampiezza veloce, come la membrana di una tromba elettrica
  if (o.buzz) {
    const am = ctx.createGain()
    am.gain.value = 0.75
    const lfo = ctx.createOscillator()
    lfo.type = 'triangle'
    lfo.frequency.value = o.buzz
    const depth = ctx.createGain()
    depth.gain.value = 0.25
    lfo.connect(depth).connect(am.gain)
    lfo.start(o.start)
    lfo.stop(end)
    node = node.connect(am)
  }

  const env = ctx.createGain()
  env.gain.setValueAtTime(0, o.start)
  env.gain.linearRampToValueAtTime(o.gain * 0.75, o.start + o.attack)
  // Piccolo "gonfiarsi" dopo l'attacco, poi tenuta
  env.gain.linearRampToValueAtTime(o.gain, o.start + o.attack * 2.5)
  env.gain.setValueAtTime(o.gain, Math.max(o.start + o.attack * 2.5, end - o.release))
  env.gain.exponentialRampToValueAtTime(0.0001, end)
  node.connect(env).connect(out)

  // Leggera instabilità dell'intonazione (aria/membrana): rende il suono vivo
  const wobble = ctx.createOscillator()
  wobble.frequency.value = 5.3
  const wobbleDepth = ctx.createGain()
  wobbleDepth.gain.value = 3 // cent
  wobble.connect(wobbleDepth)
  wobble.start(o.start)
  wobble.stop(end)

  for (const freq of o.freqs) {
    for (const spread of [-6, 6]) {
      const osc = ctx.createOscillator()
      osc.type = o.type
      osc.frequency.value = freq
      // L'intonazione parte un po' calante e sale: il tipico "sbocciare" della tromba
      osc.detune.setValueAtTime(spread - o.pitchBloom, o.start)
      osc.detune.setTargetAtTime(spread, o.start, o.attack * 0.8)
      wobbleDepth.connect(osc.detune)
      osc.connect(sum)
      osc.start(o.start)
      osc.stop(end)
    }
  }
  return end
}

/** Tromba ad aria compressa della sirena del gol. */
function goalHorn(ctx: BaseAudioContext, out: AudioNode, start: number, duration: number) {
  return horn(ctx, out, {
    // Accordo grave (Mi♭ maggiore) con l'ottava sotto: pieno e potente
    freqs: [77.8, 155.6, 196, 233.1],
    start,
    duration,
    gain: 0.5,
    type: 'sawtooth',
    attack: 0.12,
    release: 0.55,
    pitchBloom: 90,
    drive: 2.2,
    formants: [
      [180, 4, 0.8],
      [650, 7, 1.4],
      [1500, 5, 1.8],
      [2800, -4, 1],
    ],
    cutoff: 4200,
  })
}

/** Tromba elettrica del tabellone (fine periodo, timeout, fine intervallo). */
function buzzer(ctx: BaseAudioContext, out: AudioNode, start: number, duration: number) {
  return horn(ctx, out, {
    freqs: [233.1, 293.7],
    start,
    duration,
    gain: 0.42,
    type: 'square',
    attack: 0.02,
    release: 0.12,
    pitchBloom: 30,
    drive: 3.5,
    formants: [
      [500, 3, 1.2],
      [1250, 8, 2],
      [2600, 4, 2.5],
    ],
    cutoff: 5200,
    buzz: 100,
  })
}

/** Serie di colpi di tromba elettrica. */
function blasts(
  ctx: BaseAudioContext,
  out: AudioNode,
  start: number,
  count: number,
  length: number,
  gap: number,
): number {
  let t = start
  for (let i = 0; i < count; i++) t = buzzer(ctx, out, t, length) + gap
  return t - gap
}

/** Programma il suono `id` a partire dall'istante `at`; restituisce quando finisce. */
export function scheduleSound(
  ctx: BaseAudioContext,
  out: AudioNode,
  id: SoundId,
  at: number,
): number {
  const arena = arenaInput(ctx, out)
  switch (id) {
    case 'goal':
      return goalHorn(ctx, arena, at, 4)
    case 'periodEnd':
      return buzzer(ctx, arena, at, 2.6)
    case 'timeout':
      return blasts(ctx, arena, at, 2, 0.45, 0.25)
    case 'timeoutEnd':
      return buzzer(ctx, arena, at, 1.1)
    case 'intermissionEnd':
      return blasts(ctx, arena, at, 3, 0.35, 0.2)
  }
}
