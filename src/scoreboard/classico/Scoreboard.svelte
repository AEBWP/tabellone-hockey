<script lang="ts">
  import type { GameView, TeamId } from '../../engine'
  import { textColorOn } from '../../shared/color'
  import { boardText, phaseLabel, previousPeriod } from '../../i18n/board'
  import GoalOverlay from './GoalOverlay.svelte'
  import PenaltyPanel from './PenaltyPanel.svelte'
  import ShootoutPanel from './ShootoutPanel.svelte'
  import TeamPanel from './TeamPanel.svelte'

  /**
   * Tabellone spettatori, disegnato su 1920×1080 pixel logici.
   * Usato sia sul maxischermo sia (rimpicciolito) come anteprima nella console.
   */
  let { view, animations = true }: { view: GameView; animations?: boolean } = $props()

  const text = $derived(boardText(view))
  const lastMinute = $derived(view.phase === 'play' && view.clockText.includes('.'))
  const winner = $derived.by<TeamId | null>(() => {
    if (view.phase !== 'final') return null
    const { home, away } = view.teams
    return home.score === away.score ? null : home.score > away.score ? 'home' : 'away'
  })
</script>

<div class="board">
  <div class="ice"></div>

  <header>
    <div class="phase" class:final={view.phase === 'final'}>{phaseLabel(view)}</div>
  </header>

  <section class="main">
    <TeamPanel team={view.teams.home} dimmed={winner === 'away'} {text} />

    <div class="center">
      {#if view.phase === 'intermission' && view.intermission}
        <div class="sub">{text.endOf(previousPeriod(view))}</div>
        <div class="clock intermission">{view.intermission.text}</div>
        <div class="sub">{text.next(view)}</div>
      {:else if view.phase === 'shootout'}
        <div class="clock word">{text.shootoutWord}</div>
      {:else if view.phase === 'final'}
        <div class="clock word">{text.finalShort}</div>
      {:else}
        <div class="clock" class:stopped={!view.clockRunning} class:urgent={lastMinute}>
          {view.clockText}
        </div>
        {#if view.powerPlay}
          {@const pp = view.teams[view.powerPlay]}
          <div class="powerplay" style:--team={pp.color}>
            {text.powerPlay}
            {pp.shortName}
            <span class="strength">{view.teams.home.skaters} vs {view.teams.away.skaters}</span>
          </div>
        {/if}
      {/if}
    </div>

    <TeamPanel team={view.teams.away} dimmed={winner === 'home'} {text} />
  </section>

  <section class="bottom">
    {#if view.shootout}
      {@const so = view.shootout}
      <ShootoutPanel shots={so.home} rounds={so.rounds} winner={so.winner === 'home'} {text} />
      <div></div>
      <ShootoutPanel shots={so.away} rounds={so.rounds} winner={so.winner === 'away'} {text} />
    {:else}
      <PenaltyPanel team={view.teams.home} {text} />
      {#if view.timeout}
        {@const t = view.teams[view.timeout.team]}
        <div class="timeout" style:--team={t.color} style:--on-team={textColorOn(t.color)}>
          <div class="timeout-label">{text.timeout} {t.shortName}</div>
          <div class="timeout-clock">{view.timeout.text}</div>
        </div>
      {:else}
        <div class="stats" style:visibility={view.showShots ? null : 'hidden'}>
          <div class="stat-label">{text.shotsOnGoal}</div>
          <div class="stat-row">
            <span>{view.teams.home.shots}</span>
            <span>{view.teams.away.shots}</span>
          </div>
        </div>
      {/if}
      <PenaltyPanel team={view.teams.away} {text} />
    {/if}
  </section>

  {#if animations}
    <GoalOverlay {view} />
  {/if}
</div>

<style>
  .board {
    position: relative;
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    color: #f4f8fd;
    font-family: 'Barlow Condensed', var(--font-ui);
    font-variant-numeric: tabular-nums;
    background: #050b16;
  }

  /* Riflesso del ghiaccio, solo CSS. */
  .ice {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 55% at 50% 42%, rgba(70, 130, 200, 0.28), transparent 70%),
      radial-gradient(ellipse 120% 60% at 50% 120%, rgba(30, 80, 140, 0.35), transparent 60%),
      linear-gradient(180deg, #0a1a30 0%, #050b16 100%);
  }

  header,
  .main,
  .bottom {
    position: relative;
  }

  header {
    display: flex;
    justify-content: center;
    height: 140px;
    padding-top: 36px;
  }

  .phase {
    padding: 6px 48px;
    border: 3px solid rgba(156, 195, 234, 0.45);
    border-radius: 999px;
    font-size: 64px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: 0.08em;
    background: rgba(5, 13, 24, 0.6);
  }

  .phase.final {
    border-color: #ffd166;
    color: #ffd166;
  }

  .main {
    display: grid;
    /* Colonne fisse: il centro non può mai spingere fuori le squadre. */
    grid-template-columns: 560px minmax(0, 1fr) 560px;
    gap: 24px;
    height: 600px;
    padding: 0 24px;
  }

  .center {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .clock {
    font-size: 270px;
    white-space: nowrap;
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0.01em;
    text-shadow: 0 0 40px rgba(120, 180, 255, 0.35);
  }

  .clock.stopped {
    color: #ffd166;
    text-shadow: 0 0 40px rgba(255, 209, 102, 0.25);
  }

  .clock.urgent {
    color: #ff5d5d;
    text-shadow: 0 0 50px rgba(255, 80, 80, 0.45);
  }

  .clock.intermission {
    font-size: 240px;
    color: #9cc3ea;
  }

  .clock.word {
    font-size: 180px;
    letter-spacing: 0.06em;
  }

  .sub {
    font-size: 48px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #9cc3ea;
  }

  .powerplay {
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 8px 28px;
    border-radius: 14px;
    font-size: 52px;
    font-weight: 700;
    letter-spacing: 0.05em;
    background: color-mix(in srgb, var(--team) 35%, transparent);
    border: 3px solid var(--team);
  }

  .strength {
    padding: 0 16px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.35);
  }

  .bottom {
    display: grid;
    /* Colonne fisse: il centro non può mai spingere fuori le squadre. */
    grid-template-columns: 560px minmax(0, 1fr) 560px;
    gap: 24px;
    height: 340px;
    padding: 0 24px 40px;
  }

  .stats {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .stat-label {
    font-size: 40px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #9cc3ea;
  }

  .stat-row {
    display: flex;
    gap: 140px;
    font-size: 110px;
    font-weight: 800;
    line-height: 1.1;
  }

  .timeout {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 10px 0 20px;
    border-radius: 24px;
    color: var(--on-team);
    background: linear-gradient(180deg, var(--team), color-mix(in srgb, var(--team) 65%, black));
    box-shadow: 0 0 60px color-mix(in srgb, var(--team) 50%, transparent);
    animation: pop 300ms ease-out;
  }

  .timeout-label {
    font-size: 64px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  .timeout-clock {
    padding: 0 32px;
    border-radius: 16px;
    font-size: 130px;
    font-weight: 800;
    line-height: 1.05;
    color: #fff;
    background: rgba(0, 0, 0, 0.3);
  }

  @keyframes pop {
    from {
      transform: scale(0.85);
      opacity: 0;
    }
  }
</style>
