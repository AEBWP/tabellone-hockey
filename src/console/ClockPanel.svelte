<script lang="ts">
  import type { Command, GameView } from '../engine'
  import { BOARD_TEXT, phaseLabel, previousPeriod } from '../i18n/board'
  import { t, ui } from '../i18n/ui.svelte'
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
  /** Nomi dei periodi nella lingua della console (non in quella del tabellone). */
  const words = $derived(BOARD_TEXT[ui.lang])

  function endPeriod() {
    // Se il tempo arriva a zero mentre la conferma è aperta, il periodo è già
    // finito: la conferma non deve chiudere anche quello successivo.
    const period = view.period
    confirm({
      title: t('Terminare il periodo?'),
      message: t(
        'Il tempo va a zero e si passa all’intervallo (o al supplementare / fine partita). Usalo se il tempo è finito ma il cronometro non era sincronizzato.',
      ),
      confirmLabel: t('Termina periodo'),
      action: () => {
        if (view.period === period && (view.phase === 'play' || view.phase === 'ready'))
          run({ type: 'endPeriod' })
      },
    })
  }

  function endGame() {
    confirm({
      title: view.clockOnly ? t('Terminare il cronometro?') : t('Terminare la partita?'),
      message: view.clockOnly
        ? t('Il cronometro si ferma e il tabellone mostra la fine.')
        : t('Il tabellone mostrerà “{final}” con il punteggio attuale.', {
            final: BOARD_TEXT[view.language].final,
          }),
      confirmLabel: view.clockOnly ? t('Termina') : t('Termina partita'),
      danger: true,
      action: () => run({ type: 'endGame' }),
    })
  }
</script>

<section class="panel clock-panel">
  <h2 class="panel-title">
    {t('Tempo di gioco')}
    <HelpTip title={t('Tempo di gioco')}>
      {@html view.clockOnly
        ? t(
            'Un solo cronometro per tutti i campi. Si avvia e si ferma con il pulsante grande o con la <kbd>barra spaziatrice</kbd>: a zero suona la sirena e il tempo finisce.',
          )
        : t(
            'Avvia e ferma il cronometro con il pulsante grande o con la <kbd>barra spaziatrice</kbd>. Quando il tempo arriva a zero si passa da solo all’intervallo e poi al periodo successivo. Le penalità scorrono solo quando il tempo è in moto.',
          )}
    </HelpTip>
    {#if !view.clockOnly}
      <!-- Azione rapida: scambia i lati delle squadre in console e su tutti i tabelloni. -->
      <button
        type="button"
        class="btn btn-sm swap-sides"
        title={t(
          'Scambia i lati delle squadre in console e sui tabelloni (punti e penalità restano a ogni squadra)',
        )}
        onclick={() => run({ type: 'swapSides' })}
      >
        ⇄ {t('Inverti squadre')}
      </button>
    {/if}
  </h2>

  {#if !view.clockOnly}
    <div class="phase">{phaseLabel({ ...view, language: ui.lang })}</div>
  {/if}

  {#if view.phase === 'intermission' && view.intermission}
    <div class="time intermission">{view.intermission.text}</div>
    <div class="state">
      {t('Finito: {ended} · prossimo: {next}', {
        ended: words.period(previousPeriod(view)),
        next: words.period(view),
      })}
    </div>
    <button
      type="button"
      class="btn btn-primary btn-lg main-btn"
      onclick={() => run({ type: 'endIntermission' })}
    >
      {t('Termina intervallo')}
      <kbd>{t('Spazio')}</kbd>
    </button>
  {:else if view.phase === 'shootout'}
    <div class="time word">{words.shootoutWord}</div>
    <div class="state">{t('Segna i tiri nei pannelli delle squadre')}</div>
  {:else if view.phase === 'final'}
    <div class="time word">{words.finalShort}</div>
    <div class="state">{view.clockOnly ? t('Cronometro finito') : t('Partita terminata')}</div>
    <button type="button" class="btn btn-primary btn-lg main-btn" onclick={onNewGame}>
      {view.clockOnly ? t('Nuovo cronometro') : t('Nuova partita')}
      <kbd>{t('Spazio')}</kbd>
    </button>
  {:else}
    <div class="time" class:running={view.clockRunning} class:urgent={lastMinute}>
      {view.clockText}
    </div>
    <div class="state" class:running={view.clockRunning}>
      {view.clockRunning
        ? `● ${t('Gioco in corso')}`
        : view.phase === 'ready'
          ? view.pregame
            ? t('Partita non iniziata: avvia il tempo per cominciare')
            : t('Pronto a iniziare')
          : `❚❚ ${t('Tempo fermo')}`}
    </div>
    <button
      type="button"
      class="btn btn-lg main-btn {view.clockRunning ? 'btn-stop' : 'btn-go'}"
      disabled={!canRunClock || view.clockMs <= 0}
      onclick={() => run({ type: 'toggleClock' })}
    >
      {view.clockRunning
        ? `■ ${t('Ferma tempo')}`
        : `▶ ${view.pregame ? t('Avvia partita') : t('Avvia tempo')}`}
      <kbd>{t('Spazio')}</kbd>
    </button>
  {/if}

  {#if view.timeout}
    <div class="timeout">
      <span>{t('Timeout {team}', { team: view.teams[view.timeout.team].name })}</span>
      <strong>{view.timeout.text}</strong>
      <button type="button" class="btn btn-sm" onclick={() => run({ type: 'endTimeout' })}>
        {t('Termina')}
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
      {t('Correggi tempo…')}
    </button>
    {#if !view.clockOnly}
      <button
        type="button"
        class="btn btn-sm"
        disabled={!canRunClock || view.pregame}
        onclick={endPeriod}
      >
        {t('Fine periodo')}
      </button>
    {/if}
    <button
      type="button"
      class="btn btn-sm btn-danger"
      disabled={view.pregame || view.phase === 'final'}
      onclick={endGame}
    >
      {view.clockOnly ? t('Fine cronometro') : t('Fine partita')}
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

  .swap-sides {
    margin-left: auto;
    letter-spacing: normal;
    text-transform: none;
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
