<script lang="ts">
  import type { Command, GameView, PenaltyKind, Rules, TeamId } from '../engine'
  import { textColorOn } from '../shared/color'
  import { PENALTY_NAMES, penaltyButtonLabel } from './format'
  import HelpTip from './HelpTip.svelte'

  let {
    id,
    view,
    rules,
    run,
  }: {
    id: TeamId
    view: GameView
    rules: Rules
    /** `label` = descrizione per "Annulla"; se assente il comando non è annullabile. */
    run: (command: Command, label?: string) => void
  } = $props()

  const team = $derived(view.teams[id])
  const goalKey = $derived(id === 'home' ? 'C' : 'O')
  const side = $derived(id === 'home' ? 'Casa' : 'Ospiti')
  const inShootout = $derived(
    view.phase === 'shootout' || (view.phase === 'final' && !!view.shootout),
  )
  // Prima del via (presentazione A VS B) i comandi di gioco sono bloccati.
  const locked = $derived(view.pregame)
  const canPenalize = $derived(!locked && view.phase !== 'shootout' && view.phase !== 'final')
  const canTimeout = $derived(view.phase === 'play' && !view.timeout && team.timeoutsLeft > 0)

  const KINDS: PenaltyKind[] = ['minor', 'double-minor', 'major', 'misconduct']

  let player = $state('')
  let playerError = $state(false)
  let playerInput = $state<HTMLInputElement>()

  function addPenalty(kind: PenaltyKind) {
    const number = player.trim()
    if (!number) {
      playerError = true
      playerInput?.focus()
      return
    }
    run(
      { type: 'penalty', team: id, player: number, kind },
      `${PENALTY_NAMES[kind]} #${number} ${team.name}`,
    )
    player = ''
    playerError = false
    // Esce dal campo: così le scorciatoie (Spazio, C, O) tornano subito attive.
    playerInput?.blur()
  }

  function onPlayerKey(e: KeyboardEvent) {
    if (e.key === 'Enter') addPenalty('minor')
  }
</script>

<section class="panel team" style:--team={team.color} style:--on-team={textColorOn(team.color)}>
  <header>
    <div class="badge">
      {#if team.logo}
        <img src={team.logo} alt="" />
      {:else}
        {team.shortName.slice(0, 3)}
      {/if}
    </div>
    <div class="names">
      <span class="side">{side}</span>
      <strong>{team.name}</strong>
    </div>
  </header>

  <!-- Punteggio -->
  <div class="score-row">
    <button
      type="button"
      class="btn btn-sm"
      title="Correggi: togli un gol"
      disabled={locked || team.goals === 0}
      onclick={() =>
        run(
          { type: 'setScore', team: id, goals: team.goals - 1 },
          `Correzione punteggio ${team.name}`,
        )}
    >
      −1
    </button>
    <span class="score">{team.score}</span>
    <button
      type="button"
      class="btn btn-sm"
      title="Correggi: aggiungi un gol (senza animazione e senza effetti sulle penalità)"
      disabled={locked}
      onclick={() =>
        run(
          { type: 'setScore', team: id, goals: team.goals + 1 },
          `Correzione punteggio ${team.name}`,
        )}
    >
      +1
    </button>
  </div>

  {#if !inShootout}
    <button
      type="button"
      class="btn btn-lg goal"
      disabled={locked || view.phase === 'final'}
      onclick={() => run({ type: 'goal', team: id }, `Gol ${team.name}`)}
    >
      GOL {team.shortName}
      <kbd>{goalKey}</kbd>
    </button>
    {#if locked}
      <p class="hint locked">
        🔒 Partita non ancora iniziata: gol, tiri e penalità si attivano con <b>▶ Avvia partita</b>.
      </p>
    {:else}
      <p class="hint">
        Il pulsante GOL fa partire l’animazione e chiude la penalità minore se era in superiorità. I
        tasti ±1 servono solo per correggere.
      </p>
    {/if}
  {/if}

  <!-- Tiri e timeout -->
  <div class="stats">
    <div class="stat">
      <span class="label">
        Tiri in porta
        <HelpTip title="Tiri in porta" align={id === 'away' ? 'right' : 'left'}>
          Conta i tiri che il portiere ha dovuto parare (più i gol). Scorciatoia:
          <kbd>Maiusc</kbd> + <kbd>{goalKey}</kbd>.
        </HelpTip>
      </span>
      <div class="counter">
        <button
          type="button"
          class="btn btn-sm"
          disabled={locked || team.shots === 0}
          onclick={() => run({ type: 'shot', team: id, delta: -1 }, `Tiro ${team.name}`)}
        >
          −
        </button>
        <strong>{team.shots}</strong>
        <button
          type="button"
          class="btn btn-sm"
          disabled={locked}
          onclick={() => run({ type: 'shot', team: id, delta: 1 }, `Tiro ${team.name}`)}
        >
          +
        </button>
      </div>
    </div>

    <div class="stat">
      <span class="label">
        Timeout
        <HelpTip title="Timeout" align={id === 'away' ? 'right' : 'left'}>
          Ferma il tempo e mostra sul tabellone il conto alla rovescia di
          {Math.round(rules.timeoutMs / 1000)} secondi. Si può chiamare solo a partita in corso; ogni
          squadra ne ha {rules.timeoutsPerTeam}.
        </HelpTip>
      </span>
      <button
        type="button"
        class="btn btn-sm"
        disabled={!canTimeout}
        onclick={() => run({ type: 'timeout', team: id }, `Timeout ${team.name}`)}
      >
        Chiama timeout ({team.timeoutsLeft})
      </button>
    </div>
  </div>

  {#if inShootout && view.shootout}
    {@const shots = view.shootout[id]}
    <div class="block">
      <h3 class="panel-title">Rigori · {shots.filter(Boolean).length} gol</h3>
      <div class="so-dots">
        {#each shots as s, i (i)}
          <span class="dot" class:goal={s} title={s ? 'Gol' : 'Sbagliato'}></span>
        {:else}
          <span class="muted">Nessun tiro</span>
        {/each}
      </div>
      <div class="so-actions">
        <button
          type="button"
          class="btn btn-go"
          disabled={view.phase !== 'shootout'}
          onclick={() =>
            run({ type: 'shootoutAttempt', team: id, scored: true }, `Rigore segnato ${team.name}`)}
        >
          Rigore: gol
        </button>
        <button
          type="button"
          class="btn btn-stop"
          disabled={view.phase !== 'shootout'}
          onclick={() =>
            run(
              { type: 'shootoutAttempt', team: id, scored: false },
              `Rigore sbagliato ${team.name}`,
            )}
        >
          Sbagliato
        </button>
      </div>
    </div>
  {:else}
    <!-- Penalità -->
    <div class="block">
      <h3 class="panel-title">
        Penalità
        <HelpTip title="Penalità" align={id === 'away' ? 'right' : 'left'}>
          Scrivi il numero di maglia e scegli la durata (Invio = minore). Al massimo
          {rules.maxPenalizedOnIce} giocatori scontano la penalità insieme: le altre restano “in attesa”
          e partono da sole. <b>Termina</b> chiude in anticipo una penalità; <b>✕</b> la cancella se inserita
          per errore.
        </HelpTip>
      </h3>

      <div class="penalty-form">
        <input
          bind:this={playerInput}
          bind:value={player}
          class="input player"
          class:error={playerError}
          placeholder="N°"
          maxlength="4"
          inputmode="numeric"
          disabled={!canPenalize}
          onkeydown={onPlayerKey}
          oninput={() => (playerError = false)}
          aria-label="Numero del giocatore penalizzato"
        />
        {#each KINDS as kind (kind)}
          <button
            type="button"
            class="btn btn-sm"
            title={PENALTY_NAMES[kind]}
            disabled={!canPenalize}
            onclick={() => addPenalty(kind)}
          >
            {penaltyButtonLabel(kind, rules)}
          </button>
        {/each}
      </div>
      {#if playerError}
        <p class="error">Scrivi prima il numero del giocatore.</p>
      {/if}

      <ul class="penalties">
        {#each team.penalties as p (p.id)}
          <li class:queued={p.queued}>
            <span class="num">#{p.player}</span>
            <span class="kind">{PENALTY_NAMES[p.kind]}</span>
            <span class="rem">{p.queued ? 'in attesa' : p.text}</span>
            <button
              type="button"
              class="btn btn-sm"
              title="Termina adesso"
              onclick={() =>
                run({ type: 'endPenalty', id: p.id }, `Fine penalità #${p.player} ${team.name}`)}
            >
              Termina
            </button>
            <button
              type="button"
              class="btn btn-sm btn-danger"
              title="Cancella (inserita per errore)"
              aria-label="Cancella penalità #{p.player}"
              onclick={() =>
                run(
                  { type: 'removePenalty', id: p.id },
                  `Cancellata penalità #${p.player} ${team.name}`,
                )}
            >
              ✕
            </button>
          </li>
        {:else}
          <li class="empty muted">Nessuna penalità in corso</li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .team {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    border-top: 6px solid var(--team);
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .badge {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
    padding: 4px;
    border-radius: 10px;
    background: var(--team);
    color: var(--on-team);
    font-weight: 800;
    overflow: hidden;
  }

  .badge img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .names {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .names strong {
    overflow: hidden;
    font-size: 1.15rem;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .side {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ice-300);
  }

  .score-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
  }

  .score {
    min-width: 2ch;
    font-family: 'Barlow Condensed', var(--font-ui);
    font-size: 5rem;
    font-weight: 800;
    line-height: 1;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .goal {
    border-color: transparent;
    background: var(--team);
    color: var(--on-team);
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .goal:hover:not(:disabled) {
    background: color-mix(in srgb, var(--team) 85%, white);
  }

  .goal kbd {
    font-size: 0.6em;
  }

  .hint {
    margin: -0.3rem 0 0;
    font-size: 0.8rem;
    line-height: 1.35;
    color: var(--ice-300);
  }

  .hint.locked {
    color: var(--warn);
  }

  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ice-300);
  }

  .counter {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .counter strong {
    min-width: 2.5ch;
    font-size: 1.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .block {
    padding-top: 0.75rem;
    border-top: 1px solid var(--ice-800);
  }

  .penalty-form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .player {
    width: 4.5rem;
    text-align: center;
    font-weight: 700;
  }

  .player.error {
    outline: 2px solid var(--danger);
  }

  .error {
    margin: 0.4rem 0 0;
    font-size: 0.85rem;
    color: #ff8a8c;
  }

  .penalties {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0.6rem 0 0;
    padding: 0;
    list-style: none;
  }

  .penalties li {
    display: grid;
    grid-template-columns: auto 1fr auto auto auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    border-radius: 8px;
    background: var(--ice-950);
  }

  .penalties li.queued {
    opacity: 0.65;
  }

  .penalties li.empty {
    display: block;
    background: none;
    font-size: 0.9rem;
  }

  .num {
    font-weight: 800;
    color: #ffd166;
  }

  .kind {
    overflow: hidden;
    font-size: 0.85rem;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--ice-300);
  }

  .rem {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .so-dots {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    min-height: 28px;
    margin-bottom: 0.6rem;
  }

  .dot {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #e04848;
  }

  .dot.goal {
    background: #2fb868;
  }

  .so-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
</style>
