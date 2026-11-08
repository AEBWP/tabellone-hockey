import type { SoundSnapshot } from './sound-events'

/** Musica negli intervalli: le decisioni, separate dalla riproduzione vera e propria. */

export interface MusicTrack {
  id: string
  name: string
  /** Dove sta il file sul disco. Il programma tiene solo questo riferimento, non una copia. */
  path: string | null
  seconds: number
}

export interface MusicSettings {
  /** Musica negli intervalli sì o no. */
  enabled: boolean
  shuffle: boolean
  /** 0–100, in proporzione al volume generale. */
  volume: number
  tracks: MusicTrack[]
  /** Ultimo brano partito: il prossimo è sempre un altro, anche dopo un riavvio. */
  lastId: string | null
  /** Brani già sentiti nel giro in corso dell'ordine casuale. */
  played: string[]
}

export const DEFAULT_MUSIC: MusicSettings = {
  enabled: true,
  shuffle: true,
  volume: 70,
  tracks: [],
  lastId: null,
  played: [],
}

export type MusicEvent = 'start' | 'stop'

/** Cosa deve fare la musica passando dallo stato `prev` allo stato `cur`. */
export function musicEvent(
  prev: Pick<SoundSnapshot, 'phase'>,
  cur: Pick<SoundSnapshot, 'phase'>,
): MusicEvent | null {
  if (prev.phase === 'play' && cur.phase === 'intermission') return 'start'
  // Intervallo finito, saltato o annullato con una correzione.
  if (prev.phase === 'intermission' && cur.phase !== 'intermission') return 'stop'
  return null
}

/**
 * La traccia da far partire: mai quella partita per ultima, se ce n'è un'altra.
 * Le tracce in `unavailable` (file non raggiungibili) si saltano.
 */
export function pickNext(
  settings: Pick<MusicSettings, 'tracks' | 'lastId' | 'played' | 'shuffle'>,
  unavailable: ReadonlySet<string> = new Set(),
  random: () => number = Math.random,
): { id: string; played: string[] } | null {
  const { tracks: all, lastId, shuffle } = settings
  const tracks = all.filter((t) => !unavailable.has(t.id))
  if (!tracks.length) return null
  if (!shuffle) {
    // Si conta sull'elenco intero: una traccia mancante non fa perdere il punto.
    const last = all.findIndex((t) => t.id === lastId)
    for (let step = 1; step <= all.length; step++) {
      const track = all[(last + step) % all.length]
      if (!unavailable.has(track.id)) return { id: track.id, played: [] }
    }
    return null
  }
  const heard = new Set(settings.played)
  let played = settings.played.filter((id) => tracks.some((t) => t.id === id))
  let pool = tracks.filter((t) => !heard.has(t.id))
  if (!pool.length) {
    // Giro finito: se ne comincia un altro senza ripetere subito l'ultima traccia.
    played = []
    pool = tracks.length > 1 ? tracks.filter((t) => t.id !== lastId) : tracks
  }
  const id = pool[Math.floor(random() * pool.length)].id
  return { id, played: [...played, id] }
}

const AUDIO_NAME = /\.(mp3|wav|ogg|oga|opus|m4a|aac|flac|webm)$/i

/** Tra i file trascinati possono capitare anche copertine, cartelle e altro. */
export function isAudioFile(file: { name: string; type: string }): boolean {
  return file.type.startsWith('audio/') || AUDIO_NAME.test(file.name)
}

function cleanTracks(value: unknown): MusicTrack[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((t: Partial<MusicTrack> | null) =>
    typeof t?.id === 'string' && typeof t.name === 'string'
      ? [
          {
            id: t.id,
            name: t.name,
            path: typeof t.path === 'string' ? t.path : null,
            seconds: Number(t.seconds) || 0,
          },
        ]
      : [],
  )
}

/** Impostazioni lette dal disco: quello che non torna si rimette al valore iniziale. */
export function cleanMusicSettings(raw: unknown): MusicSettings {
  const saved = (raw && typeof raw === 'object' ? raw : {}) as Partial<MusicSettings>
  const volume = Number(saved.volume)
  return {
    enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULT_MUSIC.enabled,
    shuffle: typeof saved.shuffle === 'boolean' ? saved.shuffle : DEFAULT_MUSIC.shuffle,
    volume: Number.isFinite(volume) ? Math.min(100, Math.max(0, volume)) : DEFAULT_MUSIC.volume,
    tracks: cleanTracks(saved.tracks),
    lastId: typeof saved.lastId === 'string' ? saved.lastId : null,
    played: Array.isArray(saved.played)
      ? saved.played.filter((id): id is string => typeof id === 'string')
      : [],
  }
}
