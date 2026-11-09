import type { SoundId } from './sound-events'

/**
 * Suoni predefiniti inclusi nel programma (file in `public/sounds/`).
 *
 * Per ogni suono del tabellone (SoundId) l'operatore sceglie la "sorgente":
 * - 'synth'  → il suono sintetizzato di sempre (synth.ts), predefinito;
 * - un id di questa lista → il file incluso corrispondente;
 * - 'custom' → il file caricato dall'operatore (salvato in sound-store.ts).
 *
 * Tutti i predefiniti si possono usare per qualsiasi suono; `suggested`
 * serve solo a mostrarli per primi dove hanno più senso.
 */

export interface SoundPreset {
  /** Id stabile: finisce nelle impostazioni salvate, non va mai cambiato. */
  id: string
  /** Nome mostrato all'operatore (in italiano, tradotto con t()). */
  name: string
  /** Nome del file dentro `public/sounds/` (OGG Vorbis, mono, 44,1 kHz). */
  file: string
  /** Suoni per cui è più adatto. */
  suggested: SoundId[]
}

export const SOUND_PRESETS: SoundPreset[] = [
  {
    id: 'air-horn-classic',
    name: 'Tromba ad aria',
    file: 'air-horn-classic.ogg',
    suggested: ['goal', 'periodEnd'],
  },
  {
    id: 'air-horn-deep',
    name: 'Tromba ad aria grave',
    file: 'air-horn-deep.ogg',
    suggested: ['goal', 'periodEnd'],
  },
  {
    id: 'goal-siren',
    name: 'Sirena rotante',
    file: 'goal-siren.ogg',
    suggested: ['goal'],
  },
  {
    id: 'buzzer-long',
    name: 'Cicalino elettrico lungo',
    file: 'buzzer-long.ogg',
    suggested: ['periodEnd', 'timeoutEnd', 'intermissionEnd'],
  },
  {
    id: 'buzzer-short',
    name: 'Cicalino elettrico breve',
    file: 'buzzer-short.ogg',
    suggested: ['timeout', 'shiftChange'],
  },
  {
    id: 'bell',
    name: 'Campanella',
    file: 'bell.ogg',
    suggested: ['shiftChange', 'timeoutEnd'],
  },
]

/** Sorgente di un suono: 'synth', 'custom' o l'id di un SoundPreset. */
export type SoundSource = 'synth' | 'custom' | (string & {})

/** Percorso del file di un predefinito, relativo alla pagina (funziona in Vite e con app:// in Electron). */
export function presetUrl(preset: SoundPreset): string {
  return `./sounds/${preset.file}`
}

export function findPreset(id: string): SoundPreset | undefined {
  return SOUND_PRESETS.find((p) => p.id === id)
}
