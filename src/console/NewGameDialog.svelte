<script lang="ts">
  import { PRESETS, rulesFromPreset, type Rules } from '../engine'
  import Modal from './Modal.svelte'

  /** Nuova partita: si sceglie il regolamento, squadre e loghi restano. */
  let {
    open,
    onclose,
    onstart,
  }: { open: boolean; onclose: () => void; onstart: (rules: Rules) => void } = $props()

  let presetId = $state(PRESETS[0].id)
  const preset = $derived(PRESETS.find((p) => p.id === presetId) ?? PRESETS[0])

  function start() {
    onstart(rulesFromPreset(presetId))
    onclose()
  }
</script>

<Modal {open} {onclose} title="Nuova partita">
  <p>Punteggio, tempo, penalità e cronaca verranno azzerati. Squadre e loghi restano.</p>

  <label class="field">
    Regolamento
    <select class="input" bind:value={presetId}>
      {#each PRESETS as p (p.id)}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>
  </label>
  <p class="muted desc">{preset.description}</p>
  <p class="muted small">
    Le singole regole (durata dei periodi, penalità, timeout…) si potranno personalizzare nelle
    impostazioni.
  </p>

  {#snippet actions()}
    <button type="button" class="btn" onclick={onclose}>Annulla</button>
    <button type="button" class="btn btn-primary" onclick={start}>Inizia nuova partita</button>
  {/snippet}
</Modal>

<style>
  .desc {
    margin: 0.5rem 0 0;
  }

  .small {
    font-size: 0.85rem;
  }
</style>
