<script lang="ts">
  import { untrack } from 'svelte'
  import Modal from './Modal.svelte'

  /** Correzione del tempo rimanente nel periodo. */
  let {
    open,
    currentMs,
    maxMs,
    onclose,
    onsave,
  }: {
    open: boolean
    currentMs: number
    maxMs: number
    onclose: () => void
    onsave: (remainingMs: number) => void
  } = $props()

  let minutes = $state(0)
  let seconds = $state(0)
  let tenths = $state(0)

  // All'apertura si parte dal tempo attuale (letto una volta sola: se il
  // tempo scorre, i campi non devono cambiare mentre l'operatore scrive).
  $effect(() => {
    if (!open) return
    const ms = Math.max(0, Math.round(untrack(() => currentMs) / 100) * 100)
    minutes = Math.floor(ms / 60_000)
    seconds = Math.floor((ms % 60_000) / 1000)
    tenths = Math.floor((ms % 1000) / 100)
  })

  const totalMs = $derived(
    (Number(minutes) || 0) * 60_000 + (Number(seconds) || 0) * 1000 + (Number(tenths) || 0) * 100,
  )
  const valid = $derived(totalMs >= 0 && totalMs <= maxMs && seconds < 60 && tenths < 10)

  function save() {
    if (!valid) return
    onsave(totalMs)
    onclose()
  }
</script>

<Modal {open} {onclose} title="Correggi tempo">
  <p class="muted">
    Imposta il tempo che deve <b>rimanere</b> nel periodo. Le penalità in corso non cambiano.
  </p>
  <form
    onsubmit={(e) => {
      e.preventDefault()
      save()
    }}
  >
    <label class="field">
      Minuti
      <input class="input" type="number" min="0" max="99" bind:value={minutes} />
    </label>
    <span class="sep">:</span>
    <label class="field">
      Secondi
      <input class="input" type="number" min="0" max="59" bind:value={seconds} />
    </label>
    <span class="sep">.</span>
    <label class="field">
      Decimi
      <input class="input" type="number" min="0" max="9" bind:value={tenths} />
    </label>
    <button type="submit" hidden>Salva</button>
  </form>
  {#if !valid}
    <p class="error">Tempo non valido (massimo {Math.round(maxMs / 60_000)} minuti).</p>
  {/if}

  {#snippet actions()}
    <button type="button" class="btn" onclick={onclose}>Annulla</button>
    <button type="button" class="btn btn-primary" disabled={!valid} onclick={save}>
      Imposta tempo
    </button>
  {/snippet}
</Modal>

<style>
  form {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .field {
    flex: 1;
  }

  .input {
    font-size: 1.6rem;
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .sep {
    padding-bottom: 0.5rem;
    font-size: 1.6rem;
    font-weight: 700;
  }

  .error {
    color: #ff8a8c;
  }
</style>
