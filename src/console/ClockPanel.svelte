<script lang="ts">
  import type { Command, GameView } from '../engine'
  import { phaseLabel, previousPeriodLabel, periodLabel } from '../shared/labels'
  import HelpTip from './HelpTip.svelte'
  import type { ConfirmRequest } from './confirm'

  let {
    view,
    run,
    confirm,
    onEditClock,
    onNewGame,
  }: {
    view: GameView
    run: (command: Command) => void
    confirm: (request: ConfirmRequest) => void
    onEditClock: () => void
    onNewGame: () => void
  } = $props()

  const canRunClock = $derived(view.phase === 'ready' || view.phase === 'play')
  const lastMinute = $derived(view.clockText.includes('.'))

  function endPeriod() {
    confirm({
      title: `Terminare il ${periodLabel(view).toLowerCase()}?`,
      message:
        'Il tempo va a zero e si passa all’intervallo (o al supplementare / fine partita). Usalo se il tempo è finito ma il cronometro non era sincronizzato.',
      confirmLabel: 'Termina periodo',
      action: () => run({ type: 'endPeriod' }),
    })
  }

  function endGame() {
    confirm({
      title: 'Terminare la partita?',
      message: 'Il tabellone mostrerà “FINALE” con il punteggio attuale.',
      confirmLabel: 'Termina partita',
      danger: true,
      action: () => run({ type: 'endGame' }),
    })
  }
</script>

<section class="panel clock-panel">
  <h2 class="panel-title">
    Tempo di gioco
    <HelpTip title="Tempo di gioco">
      Avvia e ferma il cronometro con il pulsante grande o con la <kbd>barra spaziatrice</kbd>.
      Quando il tempo arriva a zero si passa da solo all’intervallo e poi al periodo successivo. Le
      penalità scorrono solo quando il tempo è in moto.
    </HelpTip>
  </h2>

  <div class="phase">{phaseLabel(view)}</div>

  {#if view.phase === 'intermission' && view.intermission}
    <div class="time intermission">{view.intermission.text}</div>
    <div class="state">
      Intervallo dopo il {previousPeriodLabel(view).toLowerCase()} · poi {periodLabel(
        view,
      ).toLowerCase()}
    </div>
    <button
      type="button"
      class="btn btn-primary btn-lg main-btn"
      onclick={() => run({ type: 'endIntermission' })}
    >
      Termina intervallo
    </button>
  {:else if view.phase === 'shootout'}
    <div class="time word">RIGORI</div>
    <div class="state">Segna i tiri nei pannelli delle squadre</div>
  {:else if view.phase === 'final'}
    <div class="time word">FINALE</div>
    <div class="state">Partita terminata</div>
    <button type="button" class="btn btn-primary btn-lg main-btn" onclick={onNewGame}>
      Nuova partita…
    </button>
  {:else}
    <div class="time" class:running={view.clockRunning} class:urgent={lastMinute}>
      {view.clockText}
    </div>
    <div class="state" class:running={view.clockRunning}>
      {view.clockRunning
        ? '● Tempo in moto'
        : view.phase === 'ready'
          ? view.pregame
            ? 'Partita non iniziata: avvia il tempo per cominciare'
            : 'Pronto a iniziare'
          : '❚❚ Tempo fermo'}
    </div>
    <button
      type="button"
      class="btn btn-lg main-btn {view.clockRunning ? 'btn-stop' : 'btn-go'}"
      disabled={!canRunClock || view.clockMs <= 0}
      onclick={() => run({ type: 'toggleClock' })}
    >
      {view.clockRunning ? '■ Ferma tempo' : view.pregame ? '▶ Avvia partita' : '▶ Avvia tempo'}
      <kbd>Spazio</kbd>
    </button>
  {/if}

  {#if view.timeout}
    <div class="timeout">
      <span>Timeout {view.teams[view.timeout.team].name}</span>
      <strong>{view.timeout.text}</strong>
      <button type="button" class="btn btn-sm" onclick={() => run({ type: 'endTimeout' })}>
        Termina
      </button>
    </div>
  {/if}

  <div class="secondary">
    <button
      type="button"
      class="btn btn-sm"
      disabled={!canRunClock || view.pregame}
      onclick={onEditClock}
    >
      Correggi tempo…
    </button>
    <button
      type="button"
      class="btn btn-sm"
      disabled={!canRunClock || view.pregame}
      onclick={endPeriod}
    >
      Fine periodo
    </button>
    <button
      type="button"
      class="btn btn-sm btn-danger"
      disabled={view.pregame || view.phase === 'final'}
      onclick={endGame}
    >
      Fine partita
    </button>
  </div>
</section>

<style>
  .clock-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    text-align: center;
  }

  .clock-panel .panel-title {
    align-self: stretch;
  }

  .phase {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--ice-300);
  }

  .time {
    font-family: 'Barlow Condensed', var(--font-ui);
    font-size: clamp(4rem, 8vw, 6.5rem);
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: #ffd166;
  }

  .time.running {
    color: #fff;
  }

  .time.urgent {
    color: #ff6b6b;
  }

  .time.intermission {
    color: var(--ice-300);
  }

  .time.word {
    font-size: clamp(3rem, 6vw, 4.5rem);
    color: #fff;
  }

  .state {
    font-size: 0.9rem;
    color: #ffd166;
  }

  .state.running {
    color: var(--ok);
  }

  .main-btn {
    width: min(100%, 360px);
    margin-top: 0.4rem;
  }

  .main-btn kbd {
    font-size: 0.65em;
    opacity: 0.85;
  }

  .timeout {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 10px;
    background: rgba(255, 176, 32, 0.15);
    color: #ffd166;
  }

  .timeout strong {
    font-size: 1.3rem;
    font-variant-numeric: tabular-nums;
  }

  .secondary {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
</style>
