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
    horn,
  }: {
    view: GameView
    run: (command: Command) => void
    confirm: (request: ConfirmRequest) => void
    onEditClock: () => void
    onNewGame: () => void
    /** Tromba manuale: suona da `down` a `up`. Null se è disattivata nelle impostazioni audio. */
    horn: { on: boolean; down: () => void; up: () => void } | null
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

  {#if horn}
    <!-- Tromba manuale: un pulsante tondo a sé, come quello di una pulsantiera,
         sul lato destro del pannello. Suona finché resta premuto (anche con il
         tasto T). Il puntatore viene "catturato", così vale anche se si rilascia
         fuori dal pulsante. -->
    <div class="horn-pod" class:on={horn.on}>
      <button
        type="button"
        class="horn"
        aria-label={t('Tromba')}
        title={t('Tieni premuto per suonare la tromba')}
        onpointerdown={(e) => {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          horn.down()
        }}
        onpointerup={horn.up}
        onpointercancel={horn.up}
        onlostpointercapture={horn.up}
        oncontextmenu={(e) => e.preventDefault()}
      >
        <span class="horn-icon" aria-hidden="true">🎺</span>
        <kbd>T</kbd>
      </button>
      <small>{t('Tromba')}</small>
    </div>
  {/if}
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

  .clock-panel {
    position: relative;
  }

  /* Tromba: nello spazio libero a destra del cronometro, sopra il pulsante del
     tempo, staccata dal resto. */
  .horn-pod {
    --horn: #ffd166;
    position: absolute;
    right: 1.25rem;
    top: 8.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    user-select: none;
  }

  .horn {
    position: relative;
    display: grid;
    place-items: center;
    width: 3.25rem;
    height: 3.25rem;
    padding: 0;
    border: 2px solid color-mix(in srgb, var(--horn) 45%, transparent);
    border-radius: 50%;
    background: radial-gradient(circle at 50% 30%, #2a4468, #14253d 70%);
    /* Anello scuro attorno: il "pozzetto" in cui sta il pulsante. */
    box-shadow:
      0 0 0 5px rgba(0, 0, 0, 0.28),
      0 3px 0 5px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.14);
    color: inherit;
    cursor: pointer;
    touch-action: none;
    transition:
      transform 0.06s,
      border-color 0.12s,
      background 0.12s;
  }

  .horn:hover {
    border-color: var(--horn);
  }

  .horn:focus-visible {
    outline: 2px solid var(--ice-300);
    outline-offset: 7px;
  }

  .horn-icon {
    font-size: 1.4rem;
    line-height: 1;
  }

  /* Il tasto T, come un'etichetta appoggiata sul bordo del pulsante. */
  .horn kbd {
    position: absolute;
    right: -0.45rem;
    bottom: -0.3rem;
    font-size: 0.7rem;
  }

  .horn-pod small {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ice-300);
    opacity: 0.8;
  }

  /* Mentre suona: premuto, acceso, con le onde che si allargano. */
  .horn-pod.on .horn {
    transform: scale(0.94);
    border-color: var(--horn);
    background: radial-gradient(circle at 50% 35%, #ffe199, #f2b530 75%);
  }

  .horn-pod.on .horn::after {
    content: '';
    position: absolute;
    inset: -2px;
    border: 2px solid var(--horn);
    border-radius: 50%;
    animation: horn-wave 0.7s ease-out infinite;
    pointer-events: none;
  }

  .horn-pod.on small {
    color: var(--horn);
    opacity: 1;
  }

  @keyframes horn-wave {
    from {
      transform: scale(1);
      opacity: 0.9;
    }
    to {
      transform: scale(1.7);
      opacity: 0;
    }
  }
</style>
