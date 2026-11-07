<script lang="ts">
  import { PRESETS, rulesFromPreset, type Rules } from '../engine'
  import { t } from '../i18n/ui.svelte'
  import { describeRules } from './rules-text'
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
    if (choice.startsWith('b:')) return rulesFromPreset(choice.slice(2))
    const saved = library.presets.find((p) => `s:${p.id}` === choice)
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
      <optgroup label={t('Predefiniti')}>
        {#each PRESETS as p (p.id)}
          <option value="b:{p.id}">{t(p.name)}</option>
        {/each}
      </optgroup>
      {#if library.presets.length}
        <optgroup label={t('Salvati da te')}>
          {#each library.presets as p (p.id)}
            <option value="s:{p.id}">{p.name}</option>
          {/each}
        </optgroup>
      {/if}
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
