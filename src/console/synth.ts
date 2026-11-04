import type { SoundId } from './sound-events'

/**
 * Suoni sintetizzati con la Web Audio API: niente file da scaricare o
 * licenze da gestire, funzionano offline e pesano zero.
 */

interface ToneOptions {
  type: OscillatorType
  /** Frequenze suonate insieme (accordo). */
  freqs: number[]
  start: number
  duration: number
  gain: number
  attack?: number
  release?: number
  /** Taglio del filtro passa-basso: più basso = suono più "cupo". */
  cutoff?: number
  /** Leggera stonatura tra le voci, per un suono più pieno (cent). */
  detune?: number
  /** Vibrato (Hz); 0 = nessuno. */
  vibrato?: number
}

function tone(ctx: BaseAudioContext, out: AudioNode, o: ToneOptions): number {
  const attack = o.attack ?? 0.02
  const release = o.release ?? 0.08
  const end = o.start + o.duration

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = o.cutoff ?? 4000
  filter.Q.value = 0.8

  const env = ctx.createGain()
  env.gain.setValueAtTime(0, o.start)
  env.gain.linearRampToValueAtTime(o.gain, o.start + attack)
  env.gain.setValueAtTime(o.gain, Math.max(o.start + attack, end - release))
  env.gain.linearRampToValueAtTime(0, end)

  filter.connect(env).connect(out)

  let lfo: OscillatorNode | null = null
  let lfoGain: GainNode | null = null
  if (o.vibrato) {
    lfo = ctx.createOscillator()
    lfo.frequency.value = o.vibrato
    lfoGain = ctx.createGain()
    lfoGain.gain.value = 4 // cent
    lfo.connect(lfoGain)
    lfo.start(o.start)
    lfo.stop(end)
  }

  const voices = o.detune ? [-o.detune, o.detune] : [0]
  for (const freq of o.freqs) {
    for (const cents of voices) {
      const osc = ctx.createOscillator()
      osc.type = o.type
      osc.frequency.value = freq
      osc.detune.value = cents
      if (lfoGain) lfoGain.connect(osc.detune)
      osc.connect(filter)
      osc.start(o.start)
      osc.stop(end)
    }
  }
  return end
}

/** Programma il suono `id` a partire dall'istante `at`; restituisce quando finisce. */
export function scheduleSound(
  ctx: BaseAudioContext,
  out: AudioNode,
  id: SoundId,
  at: number,
): number {
  switch (id) {
    case 'goal':
      // Sirena da stadio: accordo grave e pieno, con un leggero vibrato.
      return tone(ctx, out, {
        type: 'sawtooth',
        freqs: [146.8, 185, 220],
        start: at,
        duration: 3.2,
        gain: 0.16,
        attack: 0.06,
        release: 0.35,
        cutoff: 1800,
        detune: 7,
        vibrato: 5.5,
      })

    case 'periodEnd':
      // Cicalino di fine periodo: più aspro e "elettrico" della sirena del gol.
      return tone(ctx, out, {
        type: 'square',
        freqs: [98, 196, 294],
        start: at,
        duration: 2.4,
        gain: 0.12,
        attack: 0.01,
        release: 0.15,
        cutoff: 2600,
        detune: 5,
      })

    case 'timeout': {
      let t = at
      for (let i = 0; i < 2; i++) {
        t = tone(ctx, out, {
          type: 'square',
          freqs: [880],
          start: t,
          duration: 0.25,
          gain: 0.24,
          cutoff: 3500,
        })
        t += 0.15
      }
      return t
    }

    case 'timeoutEnd':
      return tone(ctx, out, {
        type: 'square',
        freqs: [660, 990],
        start: at,
        duration: 0.9,
        gain: 0.17,
        cutoff: 3000,
      })

    case 'intermissionEnd': {
      let t = at
      for (let i = 0; i < 3; i++) {
        t = tone(ctx, out, {
          type: 'triangle',
          freqs: [988, 1318],
          start: t,
          duration: 0.3,
          gain: 0.24,
          cutoff: 5000,
        })
        t += 0.18
      }
      return t
    }
  }
}
