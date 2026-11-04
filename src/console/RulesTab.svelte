<script lang="ts">
  import { untrack } from 'svelte'
  import { describeRules, PRESETS, validateRules, type Rules } from '../engine'
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
  let message = $state<string | null>(null)

  const errors = $derived(validateRules(draft))
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

  function loadFrom(value: string) {
    const builtIn = PRESETS.find((p) => `b:${p.id}` === value)
    const saved = library.presets.find((p) => `s:${p.id}` === value)
    const source = builtIn?.rules ?? saved?.rules
    if (!source) return
    draft = structuredClone(source)
    presetName = saved?.name ?? ''
    message = `Caricato “${builtIn?.name ?? saved?.name}”: premi Applica per usarlo.`
  }

  function applyDraft() {
    if (errors.length) return
    onapply($state.snapshot(draft))
    message = gameStarted
      ? 'Regole applicate. Le nuove durate valgono dal prossimo periodo.'
      : 'Regole applicate alla partita.'
  }

  function savePreset() {
    const name = presetName.trim()
    if (!name || errors.length) return
    library.savePreset(name, $state.snapshot(draft))
    message = library.error ?? `Regolamento “${name}” salvato: lo trovi anche in Nuova partita.`
  }

  function deletePreset(id: string, name: string) {
    if (!confirm(`Eliminare il regolamento “${name}”?`)) return
    library.deletePreset(id)
  }
</script>

<div class="rules-tab">
  <section class="panel intro">
    <div class="row">
      <label class="field grow">
        Parti da un regolamento
        <select
          class="input"
          value=""
          onchange={(e) => {
            loadFrom(e.currentTarget.value)
            e.currentTarget.value = ''
          }}
        >
          <option value="" disabled>Scegli…</option>
          <optgroup label="Predefiniti">
            {#each PRESETS as p (p.id)}
              <option value="b:{p.id}">{p.name} — {describeRules(p.rules)}</option>
            {/each}
          </optgroup>
          {#if library.presets.length}
            <optgroup label="Salvati da te">
              {#each library.presets as p (p.id)}
                <option value="s:{p.id}">{p.name} — {describeRules(p.rules)}</option>
              {/each}
            </optgroup>
          {/if}
        </select>
      </label>
      <div class="summary">
        <span class="muted">In uso ora</span>
        <strong>{describeRules(rules)}</strong>
      </div>
    </div>
  </section>

  <div class="grid">
    <fieldset class="panel">
      <legend class="panel-title">Tempi</legend>
      <label class="field">
        Numero di periodi
        <input class="input small" type="number" min="1" max="10" bind:value={draft.periods} />
      </label>
      <DurationInput label="Durata di ogni periodo" bind:value={draft.periodMs} />
      <DurationInput
        label="Intervallo tra i periodi (0 = nessuno)"
        bind:value={draft.intermissionMs}
      />
      <label class="check">
        <input
          type="checkbox"
          checked={draft.tenthsBelowMs > 0}
          onchange={(e) => (draft.tenthsBelowMs = e.currentTarget.checked ? 60_000 : 0)}
        />
        Decimi di secondo nell’ultimo minuto
      </label>
    </fieldset>

    <fieldset class="panel">
      <legend class="panel-title">
        Supplementare
        <HelpTip title="Supplementare">
          Si gioca solo se a fine tempi regolamentari il punteggio è pari. Chi segna vince subito.
          “Numero massimo 0” significa supplementari a oltranza (playoff).
        </HelpTip>
      </legend>
      <label class="check">
        <input type="checkbox" bind:checked={draft.overtime.enabled} />
        Supplementare in caso di parità
      </label>
      <DurationInput
        label="Durata"
        bind:value={draft.overtime.periodMs}
        disabled={!draft.overtime.enabled}
      />
      <div class="row">
        <label class="field">
          Numero massimo
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
          Giocatori per squadra
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
        label="Pausa prima del supplementare"
        bind:value={draft.overtime.breakMs}
        disabled={!draft.overtime.enabled}
      />
    </fieldset>

    <fieldset class="panel">
      <legend class="panel-title">Rigori</legend>
      <label class="check">
        <input type="checkbox" bind:checked={draft.shootout.enabled} />
        Rigori se la parità resta
      </label>
      <label class="field">
        Tiratori per squadra (poi a oltranza)
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
        Penalità
        <HelpTip title="Penalità">
          La doppia minore vale due minori. “Penalizzati contemporanei” è il massimo di giocatori
          che scontano la penalità nello stesso momento (di solito 2): le altre restano in attesa.
        </HelpTip>
      </legend>
      <DurationInput label="Minore" bind:value={draft.penaltyMs.minor} />
      <DurationInput label="Maggiore" bind:value={draft.penaltyMs.major} />
      <DurationInput label="Cattiva condotta" bind:value={draft.penaltyMs.misconduct} />
      <div class="row">
        <label class="field">
          Penalizzati contemporanei
          <input
            class="input small"
            type="number"
            min="1"
            max="3"
            bind:value={draft.maxPenalizedOnIce}
          />
        </label>
        <label class="field">
          Giocatori in pista
          <input class="input small" type="number" min="3" max="6" bind:value={draft.skaters} />
        </label>
      </div>
    </fieldset>

    <fieldset class="panel">
      <legend class="panel-title">Timeout</legend>
      <DurationInput label="Durata" bind:value={draft.timeoutMs} />
      <label class="field">
        Timeout per squadra
        <input
          class="input small"
          type="number"
          min="0"
          max="5"
          bind:value={draft.timeoutsPerTeam}
        />
      </label>
    </fieldset>

    <section class="panel">
      <h2 class="panel-title">
        Regolamenti salvati
        <HelpTip title="Regolamenti salvati" align="right">
          Salva le regole che usi spesso (es. “Under 13”): le ritrovi nel menu qui sopra e quando
          inizi una nuova partita.
        </HelpTip>
      </h2>
      <div class="save-row">
        <input
          class="input"
          placeholder="Nome, es. Under 13"
          maxlength="40"
          bind:value={presetName}
          onkeydown={(e) => e.key === 'Enter' && savePreset()}
        />
        <button
          type="button"
          class="btn"
          disabled={!presetName.trim() || errors.length > 0}
          onclick={savePreset}
        >
          Salva
        </button>
      </div>
      <ul class="saved">
        {#each library.presets as p (p.id)}
          <li>
            <span>
              <strong>{p.name}</strong>
              <small class="muted">{describeRules(p.rules)}</small>
            </span>
            <button
              type="button"
              class="btn btn-sm btn-danger"
              aria-label="Elimina {p.name}"
              onclick={() => deletePreset(p.id, p.name)}
            >
              ✕
            </button>
          </li>
        {:else}
          <li class="muted">Nessun regolamento salvato.</li>
        {/each}
      </ul>
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
        Modifiche non ancora applicate.
        {#if gameStarted}Le nuove durate varranno dal prossimo periodo.{/if}
      </p>
    {:else}
      <p class="muted">Queste sono le regole della partita in corso.</p>
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
        Annulla modifiche
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={!dirty || errors.length > 0}
        onclick={applyDraft}
      >
        Applica alla partita
      </button>
    </div>
  </footer>
</div>

<style>
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
