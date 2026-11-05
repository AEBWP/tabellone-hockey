<script lang="ts">
  import type { GameView, TeamId } from '../../engine'
  import { textColorOn } from '../../shared/color'
  import { phaseLabel, periodLabel, previousPeriodLabel } from '../../shared/labels'
  import GoalOverlay from './GoalOverlay.svelte'
  import PenaltyPanel from './PenaltyPanel.svelte'
  import ShootoutPanel from './ShootoutPanel.svelte'
  import TeamPanel from './TeamPanel.svelte'

  /**
   * Tabellone spettatori, disegnato su 1920×1080 pixel logici e scalato sul
   * maxischermo. Stile "arena": pannelli incorniciati, cifre da display LED,
   * colori delle squadre usati come accento.
   */
  let { view, animations = true }: { view: GameView; animations?: boolean } = $props()

  const lastMinute = $derived(view.phase === 'play' && view.clockText.includes('.'))
  const winner = $derived.by<TeamId | null>(() => {
    if (view.phase !== 'final') return null
    const { home, away } = view.teams
    return home.score === away.score ? null : home.score > away.score ? 'home' : 'away'
  })

  /** Didascalia sopra il tempo. */
  const caption = $derived.by(() => {
    switch (view.phase) {
      case 'intermission':
        return `IL ${periodLabel(view)} INIZIA TRA`
      case 'shootout':
        return 'GOL AI RIGORI'
      case 'final':
        return 'RISULTATO'
      case 'ready':
        return 'PRONTI'
      default:
        return 'TEMPO'
    }
  })
</script>

<div class="board">
  <div class="bg"></div>

  <header class="topbar">
    <span class="rule"></span>
    <div class="plate" class:final={view.phase === 'final'}>
      {view.phase === 'intermission' ? `FINE ${previousPeriodLabel(view)}` : phaseLabel(view)}
    </div>
    <span class="rule"></span>
  </header>

  <section class="main">
    <TeamPanel team={view.teams.home} side="home" dimmed={winner === 'away'} />

    <div class="center">
      <div
        class="clock-frame"
        class:running={view.clockRunning && view.phase === 'play'}
        class:urgent={lastMinute}
        class:intermission={view.phase === 'intermission'}
      >
        <div class="caption">{caption}</div>
        {#if view.phase === 'intermission' && view.intermission}
          <div class="clock">{view.intermission.text}</div>
        {:else if view.phase === 'shootout' && view.shootout}
          <div class="clock">
            {view.shootout.home.filter(Boolean).length}<span class="dash">–</span
            >{view.shootout.away.filter(Boolean).length}
          </div>
        {:else if view.phase === 'final'}
          <div class="clock word">FINALE</div>
        {:else}
          <div class="clock" class:stopped={!view.clockRunning}>{view.clockText}</div>
        {/if}

        {#if view.powerPlay}
          {@const pp = view.teams[view.powerPlay]}
          <div class="powerplay" style:--team={pp.color} style:--on-team={textColorOn(pp.color)}>
            <span class="pp-label">SUPERIORITÀ</span>
            <span class="pp-team">{pp.shortName}</span>
            <span class="pp-strength"
              >{view.teams.home.skaters}<i>vs</i>{view.teams.away.skaters}</span
            >
          </div>
        {/if}
      </div>
    </div>

    <TeamPanel team={view.teams.away} side="away" dimmed={winner === 'home'} />
  </section>

  <section class="bottom">
    {#if view.shootout}
      {@const so = view.shootout}
      <ShootoutPanel
        team={view.teams.home}
        shots={so.home}
        rounds={so.rounds}
        winner={so.winner === 'home'}
      />
      <div></div>
      <ShootoutPanel
        team={view.teams.away}
        shots={so.away}
        rounds={so.rounds}
        winner={so.winner === 'away'}
      />
    {:else}
      <PenaltyPanel team={view.teams.home} />
      {#if view.timeout}
        {@const t = view.teams[view.timeout.team]}
        <div class="timeout" style:--team={t.color} style:--on-team={textColorOn(t.color)}>
          <div class="timeout-head">TIMEOUT <b>{t.shortName}</b></div>
          <div class="timeout-clock">{view.timeout.text}</div>
        </div>
      {:else}
        <div class="stats">
          <div class="stats-head">TIRI IN PORTA</div>
          <div class="stats-row">
            {#each [view.teams.home, view.teams.away] as t, i (i)}
              <div class="stat" style:--team={t.color}>
                <span class="stat-value">{t.shots}</span>
                <span class="stat-team">{t.shortName}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
      <PenaltyPanel team={view.teams.away} />
    {/if}
  </section>

  {#if animations}
    <GoalOverlay {view} />
  {/if}
</div>

<style>
  .board {
    --panel: linear-gradient(180deg, #111a28 0%, #0a101a 100%);
    --panel-border: rgba(150, 180, 220, 0.22);
    --panel-highlight: rgba(255, 255, 255, 0.07);
    --led-white: #f4f7fb;
    --led-amber: #ffb627;
    --led-red: #ff3d3d;
    --label: #8fa9c8;

    position: relative;
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    color: var(--led-white);
    font-family: 'Barlow Condensed', var(--font-ui);
    font-variant-numeric: tabular-nums;
    background: #03060b;
  }

  /* Fondo: nero profondo, leggera vignettatura e trama diagonale appena percettibile. */
  .bg {
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.012) 0 2px, transparent 2px 10px),
      radial-gradient(ellipse 80% 70% at 50% 45%, #0b1626 0%, #04080f 70%, #020409 100%);
  }

  .bg::after {
    /* Sottili linee d'accento in alto e in basso. */
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, transparent, rgba(120, 170, 230, 0.55), transparent) top / 100% 3px
        no-repeat,
      linear-gradient(90deg, transparent, rgba(120, 170, 230, 0.35), transparent) bottom / 100% 3px
        no-repeat;
  }

  .topbar,
  .main,
  .bottom {
    position: relative;
  }

  /* ── Barra del periodo ─────────────────────────────────────────── */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 28px;
    height: 128px;
    padding: 0 24px;
  }

  .rule {
    flex: 1;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(143, 169, 200, 0.45));
  }

  .rule:last-child {
    transform: scaleX(-1);
  }

  .plate {
    min-width: 520px;
    padding: 10px 56px 8px;
    border: 2px solid var(--panel-border);
    border-top-color: rgba(255, 255, 255, 0.22);
    clip-path: polygon(22px 0, calc(100% - 22px) 0, 100% 100%, 0 100%);
    background: var(--panel);
    font-size: 58px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.14em;
    text-align: center;
    box-shadow: inset 0 -4px 0 #4f8ed8;
  }

  .plate.final {
    color: #ffd166;
    box-shadow: inset 0 -4px 0 #ffd166;
  }

  /* ── Riga principale: squadre e tempo ─────────────────────────── */
  .main {
    display: grid;
    /* Colonne fisse: il centro non può mai spingere fuori le squadre. */
    grid-template-columns: 572px minmax(0, 1fr) 572px;
    gap: 28px;
    height: 640px;
    padding: 8px 24px 0;
  }

  /* Il riquadro del tempo è alto quanto targa + punteggio delle squadre. */
  .center {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding-bottom: 52px;
  }

  .clock-frame {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 18px 24px 40px;
    border: 2px solid var(--panel-border);
    border-radius: 6px;
    background:
      repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.015) 0 1px, transparent 1px 4px),
      linear-gradient(180deg, #060a11, #0a111c);
    box-shadow:
      inset 0 2px 0 var(--panel-highlight),
      inset 0 0 60px rgba(0, 0, 0, 0.8),
      0 20px 50px rgba(0, 0, 0, 0.5);
  }

  .clock-frame::after {
    /* Barra di stato sotto il tempo: verde in gioco, ambra fermo, rossa ultimo minuto. */
    content: '';
    position: absolute;
    left: 24px;
    right: 24px;
    bottom: 10px;
    height: 5px;
    border-radius: 3px;
    background: #ffb627;
    opacity: 0.85;
  }

  .clock-frame.running::after {
    background: #2fd27a;
  }

  .clock-frame.urgent::after {
    background: var(--led-red);
  }

  .clock-frame.intermission::after {
    background: #4f8ed8;
  }

  .caption {
    font-size: 34px;
    font-weight: 700;
    letter-spacing: 0.32em;
    color: var(--label);
  }

  .clock {
    font-size: 252px;
    font-weight: 800;
    line-height: 0.95;
    letter-spacing: 0.02em;
    white-space: nowrap;
    color: var(--led-white);
    text-shadow: 0 0 28px rgba(200, 225, 255, 0.35);
  }

  .clock.stopped {
    color: var(--led-amber);
    text-shadow: 0 0 28px rgba(255, 182, 39, 0.35);
  }

  .urgent .clock {
    color: var(--led-red);
    text-shadow: 0 0 34px rgba(255, 61, 61, 0.5);
  }

  .intermission .clock {
    font-size: 220px;
    color: #9cc3ea;
    text-shadow: 0 0 28px rgba(156, 195, 234, 0.35);
  }

  .dash {
    margin: 0 0.12em;
    color: #8fa9c8;
  }

  .clock.word {
    padding: 22px 0 18px;
    font-size: 170px;
    letter-spacing: 0.08em;
  }

  /* Superiorità numerica */
  .powerplay {
    display: flex;
    align-items: stretch;
    margin-top: 18px;
    max-width: 100%;
    overflow: hidden;
    border: 2px solid var(--team);
    border-radius: 4px;
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
    white-space: nowrap;
    box-shadow: 0 0 30px color-mix(in srgb, var(--team) 40%, transparent);
  }

  .powerplay > span {
    display: flex;
    flex: none;
    align-items: center;
    padding: 12px 18px 10px;
  }

  .pp-label {
    letter-spacing: 0.1em;
    color: var(--label);
    background: #0a101a;
  }

  /* La sigla si accorcia per prima se il riquadro è stretto. */
  .pp-team {
    flex: 0 1 auto !important;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.06em;
    color: var(--on-team);
    background: var(--team);
  }

  .pp-strength {
    gap: 10px;
    background: #0a101a;
  }

  .pp-strength i {
    font-size: 30px;
    font-style: normal;
    color: var(--label);
  }

  /* ── Riga in basso: penalità, tiri, timeout ───────────────────── */
  .bottom {
    display: grid;
    grid-template-columns: 572px minmax(0, 1fr) 572px;
    gap: 28px;
    height: 312px;
    padding: 0 24px 34px;
  }

  .stats,
  .timeout {
    display: flex;
    flex-direction: column;
    border: 2px solid var(--panel-border);
    border-radius: 6px;
    background: var(--panel);
    box-shadow: inset 0 2px 0 var(--panel-highlight);
    overflow: hidden;
  }

  .stats-head,
  .timeout-head {
    padding: 10px 0 8px;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 0.28em;
    text-align: center;
    color: var(--label);
    border-bottom: 2px solid var(--panel-border);
  }

  .stats-row {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .stat + .stat {
    border-left: 2px solid var(--panel-border);
  }

  .stat::before {
    content: '';
    position: absolute;
    top: 0;
    left: 30%;
    right: 30%;
    height: 5px;
    background: var(--team);
  }

  .stat-value {
    font-size: 132px;
    font-weight: 800;
    line-height: 1;
  }

  .stat-team {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--label);
  }

  .timeout {
    border-color: var(--team);
    box-shadow: 0 0 40px color-mix(in srgb, var(--team) 35%, transparent);
    animation: pop 300ms ease-out;
  }

  .timeout-head {
    color: var(--on-team);
    background: var(--team);
    border-bottom: 0;
  }

  .timeout-head b {
    letter-spacing: 0.1em;
  }

  .timeout-clock {
    flex: 1;
    display: grid;
    place-items: center;
    font-size: 150px;
    font-weight: 800;
    color: var(--led-amber);
    text-shadow: 0 0 28px rgba(255, 182, 39, 0.35);
  }

  @keyframes pop {
    from {
      transform: scale(0.92);
      opacity: 0;
    }
  }
</style>
