<script lang="ts">
  import type { GameView, TeamId, TeamView } from '../../engine'
  import { boardText, phaseLabel, previousPeriod } from '../../i18n/board'
  import { fitFontSize } from '../../shared/labels'
  import GoalOverlay from './GoalOverlay.svelte'

  /**
   * Stile "Essenziale": fondo nero, cifre bianche enormi, il colore delle
   * squadre solo come fascia. Niente effetti: si legge da lontano e va bene
   * anche sui PC meno potenti. Disegnato su 1920×1080 pixel logici.
   */
  let { view, animations = true }: { view: GameView; animations?: boolean } = $props()

  const text = $derived(boardText(view))
  const lastMinute = $derived(view.phase === 'play' && view.clockText.includes('.'))
  const winner = $derived.by<TeamId | null>(() => {
    if (view.phase !== 'final') return null
    const { home, away } = view.teams
    return home.score === away.score ? null : home.score > away.score ? 'home' : 'away'
  })

  const MAX_ROWS = 3
  const shown = (team: TeamView) => team.penalties.filter((p) => !p.queued).slice(0, MAX_ROWS)
  const waiting = (team: TeamView) => team.penalties.length - shown(team).length

  const slots = (shots: boolean[], rounds: number) =>
    Array.from(
      { length: Math.max(rounds, shots.length) },
      (_, i) => shots[i] as boolean | undefined,
    )
</script>

{#snippet team(t: TeamView, side: TeamId)}
  <div class="team {side}" class:dimmed={winner !== null && winner !== side} style:--team={t.color}>
    <div class="name">
      {#if t.logo}<img class="logo" src={t.logo} alt="" />{/if}
      <span class="short" style:font-size="{fitFontSize(t.shortName, 120, t.logo ? 400 : 520)}px">
        {t.shortName}
      </span>
    </div>
    <div class="score">{t.score}</div>
    <div class="timeouts">
      {#each { length: t.timeoutsLeft }, i (i)}
        <span class="to"></span>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet penalties(t: TeamView, side: TeamId)}
  <div class="penalties {side}" style:--team={t.color}>
    {#each shown(t) as p (p.id)}
      <div class="pen" class:misconduct={!p.countsForStrength}>
        <span class="player">#{p.player}</span>
        <span class="time">{p.text}</span>
      </div>
    {/each}
    {#if waiting(t) > 0}
      <div class="waiting">{text.waiting(waiting(t))}</div>
    {/if}
  </div>
{/snippet}

{#snippet shootout(shots: boolean[], rounds: number, won: boolean)}
  <div class="so" class:won>
    <div class="so-title">{text.shootout} · {shots.filter(Boolean).length}</div>
    <div class="so-shots">
      {#each slots(shots, rounds) as shot, i (i)}
        <span class="so-shot" class:goal={shot === true} class:miss={shot === false}></span>
      {/each}
    </div>
  </div>
{/snippet}

<div class="board">
  <div class="bar home" style:background={view.teams.home.color}></div>
  <div class="bar away" style:background={view.teams.away.color}></div>

  <section class="main">
    {@render team(view.teams.home, 'home')}

    <div class="center">
      <div class="phase" class:final={view.phase === 'final'}>{phaseLabel(view)}</div>
      {#if view.phase === 'intermission' && view.intermission}
        <div class="clock intermission">{view.intermission.text}</div>
        <div class="caption">{text.endOf(previousPeriod(view))} · {text.next(view)}</div>
      {:else if view.phase === 'shootout' || view.phase === 'final'}
        {@const word = view.phase === 'final' ? text.finalShort : text.shootoutWord}
        <div class="clock word" style:font-size="{fitFontSize(word, 200, 700)}px">{word}</div>
      {:else}
        <div class="clock" class:stopped={!view.clockRunning} class:urgent={lastMinute}>
          {view.clockText}
        </div>
        {#if view.powerPlay}
          {@const pp = view.teams[view.powerPlay]}
          <div class="powerplay" style:--team={pp.color}>
            {text.powerPlay}
            {pp.shortName} · {view.teams.home.skaters}:{view.teams.away.skaters}
          </div>
        {/if}
      {/if}
    </div>

    {@render team(view.teams.away, 'away')}
  </section>

  <section class="bottom">
    {#if view.shootout}
      {@const so = view.shootout}
      {@render shootout(so.home, so.rounds, so.winner === 'home')}
      <div></div>
      {@render shootout(so.away, so.rounds, so.winner === 'away')}
    {:else}
      {@render penalties(view.teams.home, 'home')}
      <div class="middle">
        {#if view.timeout}
          {@const t = view.teams[view.timeout.team]}
          <div class="label">{text.timeout} {t.shortName}</div>
          <div class="timeout-clock" style:--team={t.color}>{view.timeout.text}</div>
        {:else if view.showShots}
          <div class="label">{text.shotsOnGoal}</div>
          <div class="shots">
            <span>{view.teams.home.shots}</span>
            <span>{view.teams.away.shots}</span>
          </div>
        {/if}
      </div>
      {@render penalties(view.teams.away, 'away')}
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
    color: #fff;
    font-family: 'Barlow Condensed', var(--font-ui);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    background: #000;
  }

  /* Fasce nel colore delle squadre, in alto sopra a ciascuna. */
  .bar {
    position: absolute;
    top: 0;
    width: 600px;
    height: 26px;
  }

  .bar.home {
    left: 40px;
  }

  .bar.away {
    right: 40px;
  }

  .main,
  .bottom {
    display: grid;
    /* Colonne fisse: il centro non può mai spingere fuori le squadre. */
    grid-template-columns: 600px minmax(0, 1fr) 600px;
    gap: 20px;
    padding: 0 40px;
  }

  .main {
    height: 760px;
    padding-top: 60px;
  }

  .team {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    transition: opacity 600ms;
  }

  .team.dimmed {
    opacity: 0.35;
  }

  .name {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    max-width: 100%;
    height: 140px;
  }

  .logo {
    flex: none;
    width: 120px;
    height: 120px;
    object-fit: contain;
  }

  .short {
    min-width: 0;
    overflow: hidden;
    line-height: 1;
    letter-spacing: 0.04em;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .score {
    font-size: 470px;
    line-height: 0.95;
  }

  /* Un trattino per ogni timeout ancora disponibile. */
  .timeouts {
    display: flex;
    gap: 18px;
    height: 16px;
    margin-top: 10px;
  }

  .to {
    width: 70px;
    border-radius: 8px;
    background: var(--team);
  }

  .center {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .phase {
    height: 140px;
    font-size: 76px;
    line-height: 140px;
    letter-spacing: 0.06em;
    white-space: nowrap;
    color: #b8bec6;
  }

  .phase.final {
    color: #ffc845;
  }

  .clock {
    margin-top: 70px;
    font-size: 290px;
    line-height: 1;
    white-space: nowrap;
  }

  .clock.stopped {
    color: #ffc845;
  }

  .clock.urgent {
    color: #ff4d4d;
  }

  .clock.intermission {
    color: #b8bec6;
  }

  .clock.word {
    margin-top: 110px;
    letter-spacing: 0.04em;
  }

  .caption {
    max-width: 100%;
    overflow: hidden;
    font-size: 44px;
    letter-spacing: 0.04em;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: #b8bec6;
  }

  .powerplay {
    margin-top: 20px;
    padding: 4px 30px;
    border-radius: 10px;
    font-size: 60px;
    letter-spacing: 0.04em;
    white-space: nowrap;
    background: color-mix(in srgb, var(--team) 40%, #000);
    border: 4px solid var(--team);
  }

  .bottom {
    height: 320px;
    padding-top: 10px;
  }

  .penalties {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .pen {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0 28px;
    border-left: 12px solid var(--team);
    font-size: 84px;
    line-height: 1.1;
  }

  .pen.misconduct {
    font-size: 56px;
    color: #b8bec6;
  }

  .player {
    color: #ffc845;
  }

  .waiting {
    padding-left: 40px;
    font-size: 42px;
    color: #b8bec6;
  }

  .middle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .label {
    font-size: 48px;
    letter-spacing: 0.06em;
    color: #b8bec6;
    white-space: nowrap;
  }

  .shots {
    display: flex;
    gap: 160px;
    font-size: 130px;
    line-height: 1.05;
  }

  .timeout-clock {
    padding: 0 40px;
    border-bottom: 14px solid var(--team);
    font-size: 150px;
    line-height: 1.05;
  }

  .so {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .so-title {
    font-size: 56px;
    letter-spacing: 0.06em;
    color: #b8bec6;
  }

  .so.won .so-title {
    color: #ffc845;
  }

  .so-shots {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
  }

  /* Cerchio vuoto = da tirare, pieno verde = gol, pieno rosso = sbagliato. */
  .so-shot {
    width: 84px;
    height: 84px;
    border: 6px solid #5b6169;
    border-radius: 50%;
  }

  .so-shot.goal {
    border-color: #2fc06a;
    background: #2fc06a;
  }

  .so-shot.miss {
    border-color: #ff4d4d;
    background: #ff4d4d;
  }
</style>
