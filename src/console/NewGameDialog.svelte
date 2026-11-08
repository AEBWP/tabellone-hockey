<script lang="ts">
  import type { Rules } from '../engine'
  import { t } from '../i18n/ui.svelte'
  import { describeRules, presetLabel } from './rules-text'
  import { library } from './library.svelte'
  import Modal from './Modal.svelte'

  /** Nuova partita: si sceglie il regolamento, squadre e loghi restano. */
  let {
    open,
    currentRules,
    onclose,
    onstart,
  }: {
    open: boolean
    currentRules: Rules
    onclose: () => void
    onstart: (rules: Rules) => void
  } = $props()

  // "current" = stesso regolamento della partita appena giocata (scelta più comune).
  let choice = $state('current')

  $effect(() => {
    if (open) choice = 'current'
  })

  const selected = $derived.by((): Rules => {
    const saved = library.presets.find((p) => p.id === choice)
    return saved ? structuredClone(saved.rules) : structuredClone(currentRules)
  })

  function start() {
    onstart(selected)
    onclose()
  }
</script>

<Modal {open} {onclose} title={t('Nuova partita')}>
  <p>{t('Punteggio, tempo, penalità e cronaca verranno azzerati. Squadre e loghi restano.')}</p>

  <label class="field">
    {t('Regolamento')}
    <select class="input" bind:value={choice}>
      <option value="current">{t('Come la partita attuale')}</option>
      {#each library.presets as p (p.id)}
        <option value={p.id}>{presetLabel(p)}</option>
      {/each}
    </select>
  </label>
  <p class="muted desc">{describeRules(selected)}</p>
  <p class="muted small">
    {@html t('Puoi modificare ogni regola in <b>Impostazioni → Regolamento</b>.')}
  </p>

  {#snippet actions()}
    <button type="button" class="btn" onclick={onclose}>{t('Annulla')}</button>
    <button type="button" class="btn btn-primary" onclick={start}
      >{t('Inizia nuova partita')}</button
    >
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
