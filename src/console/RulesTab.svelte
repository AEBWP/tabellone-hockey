<script lang="ts">
  import { untrack } from 'svelte'
  import { validateRules, type Rules } from '../engine'
  import { t } from '../i18n/ui.svelte'
  import { describeRules, presetLabel } from './rules-text'
  import DurationInput from './DurationInput.svelte'
  import HelpTip from './HelpTip.svelte'
  import { library } from './library.svelte'

  let {
    rules,
    gameStarted,
    onapply,
  }: {
    /** Regole della partita in corso. */
    rules: Rules
    /** True se il periodo in corso è già iniziato (le durate valgono dal prossimo). */
    gameStarted: boolean
    onapply: (rules: Rules) => void
  } = $props()

  // Bozza modificabile: diventa effettiva solo con "Applica".
  let draft = $state<Rules>(untrack(() => structuredClone($state.snapshot(rules))))
  let presetName = $state('')
  /** Regolamento dell'archivio che si sta modificando; null = se ne crea uno nuovo. */
  let editingId = $state<string | null>(null)
  let nameInput = $state<HTMLInputElement>()
  const editing = $derived(library.presets.find((p) => p.id === editingId) ?? null)
  let message = $state<string | null>(null)

  // I messaggi del motore sono in italiano: si traducono qui.
  const errors = $derived(validateRules(draft).map((e) => t(e)))
  const dirty = $derived(JSON.stringify(draft) !== JSON.stringify(rules))

  // Se le regole cambiano da fuori (es. nuova partita o regole appena applicate), la bozza si riallinea.
  let lastRules = untrack(() => JSON.stringify(rules))
  $effect(() => {
    const current = JSON.stringify(rules)
    if (current !== lastRules) {
      lastRules = current
      draft = JSON.parse(current)
    }
  })

  function loadFrom(id: string) {
    const preset = library.presets.find((p) => p.id === id)
    if (!preset) return
    draft = structuredClone(preset.rules)
    editingId = id
    presetName = presetLabel(preset)
    message = t('Caricato “{name}”: premi Applica per usarlo.', { name: presetName })
  }

  /** Il nome è già di un altro regolamento (anche nella sua versione tradotta)? */
  function nameTaken(name: string, exceptId: string | null): boolean {
    const wanted = name.trim().toLowerCase()
    return library.presets.some(
      (p) =>
        p.id !== exceptId &&
        [p.name, presetLabel(p)].some((n) => n.trim().toLowerCase() === wanted),
    )
  }

  function newPreset() {
    editingId = null
    presetName = ''
    message = t('Scrivi un nome e premi Salva per creare il regolamento con queste regole.')
    nameInput?.focus()
  }

  function applyDraft() {
    if (errors.length) return
    onapply($state.snapshot(draft))
    message = gameStarted
      ? t('Regole applicate. Le nuove durate valgono dal prossimo periodo.')
      : t('Regole applicate alla partita.')
  }

  function savePreset() {
    const name = presetName.trim()
    if (!name || errors.length) return
    if (nameTaken(name, null)) {
      message = t('Esiste già un regolamento “{name}”.', { name })
      return
    }
    editingId = library.savePreset(name, $state.snapshot(draft)).id
    message = library.error
      ? t(library.error)
      : t('Regolamento “{name}” salvato: lo trovi anche in Nuova partita.', { name })
  }

  function saveChanges() {
    const name = presetName.trim()
    if (!editing || !name || errors.length) return
    if (nameTaken(name, editing.id)) {
      message = t('Esiste già un regolamento “{name}”.', { name })
      return
    }
    // Nome non toccato: un regolamento già pronto continua a seguire la lingua.
    const stored = name === presetLabel(editing) ? editing.name : name
    library.updatePreset(editing.id, stored, $state.snapshot(draft))
    message = library.error ? t(library.error) : t('Regolamento “{name}” aggiornato.', { name })
  }

  function deletePreset(id: string, name: string) {
    if (!confirm(t('Eliminare il regolamento “{name}”?', { name }))) return
    library.deletePreset(id)
    if (editingId === id) {
      editingId = null
      presetName = ''
    }
  }
</script>

<div class="rules-tab">
  <section class="panel intro">
    <div class="row">
      <label class="field grow">
        {t('Parti da un regolamento')}
        <select
          class="input"
          value=""
          onchange={(e) => {
            loadFrom(e.currentTarget.value)
            e.currentTarget.value = ''
          }}
        >
          <option value="" disabled>{t('Scegli…')}</option>
          {#each library.presets as p (p.id)}
            <option value={p.id}>{presetLabel(p)} — {describeRules(p.rules)}</option>
          {/each}
        </select>
      </label>
      <div class="summary">
        <span class="muted">{t('In uso ora')}</span>
        <strong>{describeRules(rules)}</strong>
      </div>
    </div>
  </section>

  <div class="grid">
    <fieldset class="panel">
      <legend class="panel-title">{t('Tempi')}</legend>
      <label class="check">
        <input type="checkbox" bind:checked={draft.clockOnly} />
        {t('Solo cronometro (più campi in contemporanea: niente punti, tempi o penalità)')}
      </label>
      {#if draft.clockOnly}
        <DurationInput label={t('Durata del cronometro')} bind:value={draft.periodMs} />
        <p class="muted hint">
          {t(
            'Un unico cronometro vale per tutti i campi: console e tabellone mostrano solo il tempo.',
          )}
        </p>
      {:else}
        <label class="field">
          {t('Numero di periodi')}
          <input class="input small" type="number" min="1" max="10" bind:value={draft.periods} />
        </label>
        <DurationInput label={t('Durata di ogni periodo')} bind:value={draft.periodMs} />
        <DurationInput
          label={t('Intervallo tra i periodi (0 = nessuno)')}
          bind:value={draft.intermissionMs}
        />
      {/if}
      <label class="check">
        <input
          type="checkbox"
          checked={draft.tenthsBelowMs > 0}
          onchange={(e) => (draft.tenthsBelowMs = e.currentTarget.checked ? 60_000 : 0)}
        />
        {t('Decimi di secondo nell’ultimo minuto')}
      </label>
      {#if !draft.clockOnly}
        <label class="check">
          <input type="checkbox" bind:checked={draft.showShots} />
          {t('Tiri in porta (in console e sul tabellone)')}
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={draft.switchSides} />
          {t('Cambio campo a ogni periodo (le squadre si scambiano i lati)')}
        </label>
      {/if}
      <DurationInput label={t('Sirena del cambio ogni (0 = mai)')} bind:value={draft.shiftHornMs} />
      <p class="muted hint">
        {t(
          'Suona a intervalli regolari mentre il tempo scorre, per il cambio dei giocatori (es. ogni minuto nelle partite dei bambini).',
        )}
      </p>
    </fieldset>

    {#if !draft.clockOnly}
      <fieldset class="panel">
        <legend class="panel-title">
          {t('Supplementare')}
          <HelpTip title={t('Supplementare')}>
            {t(
              'Si gioca solo se a fine tempi regolamentari il punteggio è pari. Chi segna vince subito. “Numero massimo 0” significa supplementari a oltranza (playoff).',
            )}
          </HelpTip>
        </legend>
        <label class="check">
          <input type="checkbox" bind:checked={draft.overtime.enabled} />
          {t('Supplementare in caso di parità')}
        </label>
        <DurationInput
          label={t('Durata')}
          bind:value={draft.overtime.periodMs}
          disabled={!draft.overtime.enabled}
        />
        <div class="row">
          <label class="field">
            {t('Numero massimo')}
            <input
              class="input small"
              type="number"
              min="0"
              max="10"
              bind:value={draft.overtime.maxPeriods}
              disabled={!draft.overtime.enabled}
            />
          </label>
          <label class="field">
            {t('Giocatori per squadra')}
            <input
              class="input small"
              type="number"
              min="3"
              max="6"
              bind:value={draft.overtime.skaters}
              disabled={!draft.overtime.enabled}
            />
          </label>
        </div>
        <DurationInput
          label={t('Pausa prima del supplementare')}
          bind:value={draft.overtime.breakMs}
          disabled={!draft.overtime.enabled}
        />
      </fieldset>

      <fieldset class="panel">
        <legend class="panel-title">{t('Rigori')}</legend>
        <label class="check">
          <input type="checkbox" bind:checked={draft.shootout.enabled} />
          {t('Rigori se la parità resta')}
        </label>
        <label class="field">
          {t('Tiratori per squadra (poi a oltranza)')}
          <input
            class="input small"
            type="number"
            min="1"
            max="10"
            bind:value={draft.shootout.rounds}
            disabled={!draft.shootout.enabled}
          />
        </label>
      </fieldset>

      <fieldset class="panel">
        <legend class="panel-title">
          {t('Penalità')}
          <HelpTip title={t('Penalità')}>
            {t(
              'La doppia minore vale due minori. “Penalizzati contemporanei” è il massimo di giocatori che scontano la penalità nello stesso momento (di solito 2): le altre restano in attesa.',
            )}
          </HelpTip>
        </legend>
        <DurationInput label={t('Minore')} bind:value={draft.penaltyMs.minor} />
        <DurationInput label={t('Maggiore')} bind:value={draft.penaltyMs.major} />
        <DurationInput label={t('Cattiva condotta')} bind:value={draft.penaltyMs.misconduct} />
        <div class="row">
          <label class="field">
            {t('Penalizzati contemporanei')}
            <input
              class="input small"
              type="number"
              min="1"
              max="3"
              bind:value={draft.maxPenalizedOnIce}
            />
          </label>
          <label class="field">
            {t('Giocatori in pista')}
            <input class="input small" type="number" min="3" max="6" bind:value={draft.skaters} />
          </label>
        </div>
      </fieldset>

      <fieldset class="panel">
        <legend class="panel-title">{t('Timeout')}</legend>
        <DurationInput label={t('Durata')} bind:value={draft.timeoutMs} />
        <label class="field">
          {t('Timeout per squadra')}
          <input
            class="input small"
            type="number"
            min="0"
            max="5"
            bind:value={draft.timeoutsPerTeam}
          />
        </label>
      </fieldset>
    {/if}

    <section class="panel">
      <h2 class="panel-title">
        {t('Regolamenti')}
        <HelpTip title={t('Regolamenti')} align="right">
          {t(
            'Tutti i regolamenti, anche quelli già pronti: puoi modificarli, cancellarli o crearne di nuovi. Li ritrovi nel menu qui sopra e quando inizi una nuova partita.',
          )}
        </HelpTip>
      </h2>
      <div class="save-row">
        <input
          class="input"
          placeholder={t('Nome, es. Under 13')}
          maxlength="40"
          bind:this={nameInput}
          bind:value={presetName}
          onkeydown={(e) => e.key === 'Enter' && (editing ? saveChanges() : savePreset())}
        />
      </div>
      <div class="save-buttons">
        {#if editing}
          <button
            type="button"
            class="btn btn-primary"
            disabled={!presetName.trim() || errors.length > 0}
            onclick={saveChanges}
          >
            {t('Salva modifiche')}
          </button>
          <button
            type="button"
            class="btn"
            disabled={!presetName.trim() || errors.length > 0}
            onclick={savePreset}
          >
            {t('Salva come nuovo')}
          </button>
          <button type="button" class="btn" onclick={newPreset}>{t('Nuovo regolamento')}</button>
        {:else}
          <button
            type="button"
            class="btn btn-primary"
            disabled={!presetName.trim() || errors.length > 0}
            onclick={savePreset}
          >
            {t('Salva')}
          </button>
        {/if}
      </div>
      <ul class="saved">
        {#each library.presets as p (p.id)}
          <li class:editing={p.id === editingId}>
            <span>
              <strong>{presetLabel(p)}</strong>
              <small class="muted">{describeRules(p.rules)}</small>
            </span>
            <div class="row-buttons">
              <button
                type="button"
                class="btn btn-sm"
                aria-label={t('Modifica {name}', { name: presetLabel(p) })}
                title={t('Modifica {name}', { name: presetLabel(p) })}
                onclick={() => loadFrom(p.id)}
              >
                ✎
              </button>
              <button
                type="button"
                class="btn btn-sm btn-danger"
                aria-label={t('Elimina {name}', { name: presetLabel(p) })}
                onclick={() => deletePreset(p.id, presetLabel(p))}
              >
                ✕
              </button>
            </div>
          </li>
        {:else}
          <li class="muted">{t('Nessun regolamento salvato.')}</li>
        {/each}
      </ul>
      {#if library.removedBuiltins > 0}
        <button type="button" class="btn btn-sm restore" onclick={() => library.restoreBuiltins()}>
          {t('Ripristina i predefiniti cancellati')}
        </button>
      {/if}
    </section>
  </div>

  <footer class="panel actions">
    {#if errors.length}
      <ul class="errors">
        {#each errors as e (e)}<li>{e}</li>{/each}
      </ul>
    {:else if message}
      <p class="message">{message}</p>
    {:else if dirty}
      <p class="muted">
        {t('Modifiche non ancora applicate.')}
        {#if gameStarted}{t('Le nuove durate varranno dal prossimo periodo.')}{/if}
      </p>
    {:else}
      <p class="muted">{t('Queste sono le regole della partita in corso.')}</p>
    {/if}
    <div class="buttons">
      <button
        type="button"
        class="btn"
        disabled={!dirty}
        onclick={() => {
          draft = structuredClone($state.snapshot(rules))
          message = null
        }}
      >
        {t('Annulla modifiche')}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={!dirty || errors.length > 0}
        onclick={applyDraft}
      >
        {t('Applica alla partita')}
      </button>
    </div>
  </footer>
</div>

<style>
  .hint {
    margin: -0.25rem 0 0;
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .rules-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 1200px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1rem;
  }

  .grow {
    flex: 1;
    min-width: 260px;
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.9rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    margin: 0;
  }

  legend {
    float: left;
    width: 100%;
    padding: 0;
  }

  legend + * {
    clear: both;
  }

  .small {
    width: 5rem;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .check input {
    width: 18px;
    height: 18px;
  }

  .save-row {
    display: flex;
    gap: 0.5rem;
  }

  .save-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .row-buttons {
    display: flex;
    flex: none;
    gap: 0.3rem;
  }

  .saved li.editing strong {
    color: var(--ok);
  }

  .restore {
    margin-top: 0.75rem;
  }

  .saved {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
  }

  .saved li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .saved span {
    display: flex;
    flex-direction: column;
  }

  .actions {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.35);
  }

  .actions p,
  .errors {
    margin: 0;
  }

  .errors {
    padding-left: 1.2rem;
    color: #ff8a8c;
  }

  .message {
    color: var(--ok);
  }

  .buttons {
    display: flex;
    gap: 0.5rem;
  }
</style>
