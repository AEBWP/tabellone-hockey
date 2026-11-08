import { PRESETS, type Rules, type TeamSetup } from '../engine'
import {
  loadKnownBuiltins,
  loadLibrary,
  mergeById,
  newId,
  removedBuiltins,
  saveKnownBuiltins,
  saveLibrary,
  seedBuiltins,
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
    const known = loadKnownBuiltins()
    const seeded = seedBuiltins(data.presets, known)
    this.presets = seeded.presets
    if (seeded.presets.length !== data.presets.length) this.persist()
    if (seeded.known.length !== known.length) saveKnownBuiltins(seeded.known)
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

  /** Crea un nuovo regolamento. */
  savePreset(name: string, rules: Rules): SavedPreset {
    const preset: SavedPreset = {
      id: newId(),
      name: name.trim(),
      rules: structuredClone(rules),
    }
    this.presets = [...this.presets, preset]
    this.persist()
    return preset
  }

  /** Modifica un regolamento esistente (anche uno di quelli già pronti). */
  updatePreset(id: string, name: string, rules: Rules) {
    this.presets = this.presets.map((p) =>
      p.id === id ? { id, name: name.trim(), rules: structuredClone(rules) } : p,
    )
    this.persist()
  }

  /** Quanti regolamenti già pronti sono stati cancellati. */
  get removedBuiltins(): number {
    return removedBuiltins(this.presets).length
  }

  /** Rimette i regolamenti già pronti cancellati; quelli modificati restano come sono. */
  restoreBuiltins() {
    const missing = removedBuiltins(this.presets)
    const known = PRESETS.map((p) => p.id).filter((id) => !missing.includes(id))
    this.presets = seedBuiltins(this.presets, known).presets
    this.persist()
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
