<script lang="ts">
  import { untrack } from 'svelte'
  import Modal from './Modal.svelte'
  import { t } from '../i18n/ui.svelte'

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

  /**
   * Il tempo non si ferma mentre si corregge. Finché l'operatore non tocca un
   * campo, i campi seguono il tempo che scorre; appena ne modifica uno restano
   * fermi su quello che scrive. Un OK senza modifiche non cambia nulla, così il
   * tempo non torna indietro per un clic distratto.
   */
  let edited = $state(false)
  $effect(() => {
    if (!open) {
      edited = false
      return
    }
    if (untrack(() => edited)) return
    const ms = Math.max(0, Math.round(currentMs / 100) * 100)
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
    if (edited) onsave(totalMs)
    onclose()
  }
</script>

<Modal {open} {onclose} title={t('Correggi tempo')}>
  <p class="muted">
    {@html t(
      'Imposta il tempo che deve <b>rimanere</b> nel periodo. Le penalità in corso non cambiano.',
    )}
  </p>
  <form
    onsubmit={(e) => {
      e.preventDefault()
      save()
    }}
  >
    <label class="field">
      {t('Minuti')}
      <input
        class="input"
        type="number"
        min="0"
        max="99"
        bind:value={minutes}
        oninput={() => (edited = true)}
      />
    </label>
    <span class="sep">:</span>
    <label class="field">
      {t('Secondi')}
      <input
        class="input"
        type="number"
        min="0"
        max="59"
        bind:value={seconds}
        oninput={() => (edited = true)}
      />
    </label>
    <span class="sep">.</span>
    <label class="field">
      {t('Decimi')}
      <input
        class="input"
        type="number"
        min="0"
        max="9"
        bind:value={tenths}
        oninput={() => (edited = true)}
      />
    </label>
    <button type="submit" hidden>{t('Salva')}</button>
  </form>
  {#if !valid}
    <p class="error">
      {t('Tempo non valido (massimo {n} minuti).', { n: Math.round(maxMs / 60_000) })}
    </p>
  {/if}

  {#snippet actions()}
    <button type="button" class="btn" onclick={onclose}>{t('Annulla')}</button>
    <button type="button" class="btn btn-primary" disabled={!valid} onclick={save}>
      {t('Imposta tempo')}
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
