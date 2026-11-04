import type { Rules, TeamSetup } from '../engine'
import {
  loadLibrary,
  mergeById,
  newId,
  saveLibrary,
  type LibraryData,
  type SavedPreset,
  type SavedTeam,
} from '../shared/library'

/** Archivio di squadre e regolamenti, condiviso dalle schede della console. */
class Library {
  teams = $state.raw<SavedTeam[]>([])
  presets = $state.raw<SavedPreset[]>([])
  /** Ultimo errore di salvataggio (es. spazio esaurito), da mostrare all'operatore. */
  error = $state<string | null>(null)

  constructor() {
    const data = loadLibrary()
    this.teams = data.teams
    this.presets = data.presets
  }

  private persist() {
    this.error = saveLibrary({ teams: this.teams, presets: this.presets })
  }

  /** Salva una squadra; se ne esiste già una con lo stesso nome la aggiorna. */
  saveTeam(setup: TeamSetup): SavedTeam {
    const existing = this.teams.find(
      (t) => t.name.trim().toLowerCase() === setup.name.trim().toLowerCase(),
    )
    const team: SavedTeam = { ...setup, id: existing?.id ?? newId() }
    this.teams = existing
      ? this.teams.map((t) => (t.id === team.id ? team : t))
      : [...this.teams, team].sort((a, b) => a.name.localeCompare(b.name, 'it'))
    this.persist()
    return team
  }

  deleteTeam(id: string) {
    this.teams = this.teams.filter((t) => t.id !== id)
    this.persist()
  }

  /** Salva un regolamento; se ne esiste già uno con lo stesso nome lo aggiorna. */
  savePreset(name: string, rules: Rules): SavedPreset {
    const existing = this.presets.find(
      (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase(),
    )
    const preset: SavedPreset = {
      id: existing?.id ?? newId(),
      name: name.trim(),
      rules: structuredClone(rules),
    }
    this.presets = existing
      ? this.presets.map((p) => (p.id === preset.id ? preset : p))
      : [...this.presets, preset]
    this.persist()
    return preset
  }

  deletePreset(id: string) {
    this.presets = this.presets.filter((p) => p.id !== id)
    this.persist()
  }

  /** Aggiunge i dati di un backup (le voci con lo stesso id vengono aggiornate). */
  import(data: LibraryData) {
    this.teams = mergeById(this.teams, data.teams).sort((a, b) =>
      a.name.localeCompare(b.name, 'it'),
    )
    this.presets = mergeById(this.presets, data.presets)
    this.persist()
  }
}

export const library = new Library()
