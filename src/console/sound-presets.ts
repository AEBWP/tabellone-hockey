/**
 * Varianti dei suoni incluse nel programma.
 *
 * Per ogni suono del tabellone (SoundId) l'operatore sceglie la "sorgente":
 * - 'synth'  → il suono principale di sempre, predefinito;
 * - un id di questa lista → lo stesso segnale con un altro timbro;
 * - 'custom' → il file caricato dall'operatore (salvato in sound-store.ts).
 *
 * Le varianti cambiano solo il timbro: durate e pause sono quelle di
 * SOUND_RHYTHMS in synth.ts, uguali per tutte.
 */

export type PresetId = 'air-horn-classic' | 'tv-horn' | 'brass-horn'

/** Timbro del sintetizzatore: il principale o una delle varianti. */
export type TimbreId = 'synth' | PresetId

export interface SoundPreset {
  /** Id stabile: finisce nelle impostazioni salvate, non va mai cambiato. */
  id: PresetId
  /** Nome mostrato all'operatore (in italiano, tradotto con t()). */
  name: string
}

export const SOUND_PRESETS: SoundPreset[] = [
  { id: 'air-horn-classic', name: 'Tromba ad aria' },
  { id: 'tv-horn', name: 'Sirena televisiva' },
  { id: 'brass-horn', name: 'Tromba d’ottone' },
]

/** Sorgente di un suono: 'synth', 'custom' o l'id di un SoundPreset. */
export type SoundSource = 'synth' | 'custom' | (string & {})

export function findPreset(id: string): SoundPreset | undefined {
  return SOUND_PRESETS.find((p) => p.id === id)
}
