<script lang="ts">
  import type { GameView, TeamId, TeamView } from '../../engine'
  import { boardText, phaseLabel, previousPeriod } from '../../i18n/board'
  import { fitFontSize } from '../../shared/labels'
  import Flaps from './Flaps.svelte'
  import GoalOverlay from './GoalOverlay.svelte'

  /**
   * Stile "Palette": il vecchio tabellone a tessere che girano. Poche cose,
   * molto grandi: squadre, punteggio, tempo e penalità, leggibili da lontano.
   * Disegnato su 1920×1080 pixel logici.
   */
  let { view, animations = true }: { view: GameView; animations?: boolean } = $props()

  const text = $derived(boardText(view))
  const lastMinute = $derived(view.phase === 'play' && view.clockText.includes('.'))
  const winner = $derived.by<TeamId | null>(() => {
    if (view.phase !== 'final') return null
    const { home, away } = view.teams
    return home.score === away.score ? null : home.score > away.score ? 'home' : 'away'
  })

  /** Penalità in corso da mostrare (max 3) e quante altre aspettano. */
  const MAX_ROWS = 3
  const shown = (team: TeamView) => team.penalties.filter((p) => !p.queued).slice(0, MAX_ROWS)
  const waiting = (team: TeamView) => team.penalties.length - shown(team).length

  /** Tiri dei rigori: almeno la serie regolare, poi quelli della morte improvvisa. */
  const slots = (shots: boolean[], rounds: number) =>
    Array.from(
      { length: Math.max(rounds, shots.length) },
      (_, i) => shots[i] as boolean | undefined,
    )
</script>

{#snippet team(t: TeamView, side: TeamId)}
  <div class="team" class:dimmed={winner !== null && winner !== side} style:--team={t.color}>
    <div class="name-card">
      {#if t.logo}<img class="logo" src={t.logo} alt="" />{/if}
      <span class="short" style:font-size="{fitFontSize(t.shortName, 100, t.logo ? 380 : 480)}px">
        {t.shortName}
      </span>
    </div>
    <div class="score">
      <Flaps value={String(t.score)} width={200} height={320} size={300} flip={animations} />
    </div>
    <div class="timeouts">
      {#each { length: t.timeoutsLeft }, i (i)}
        <span class="to">{text.timeoutAbbr}</span>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet penalties(t: TeamView)}
  <div class="penalties" style:--team={t.color}>
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
  <header>
    <div class="plate" class:final={view.phase === 'final'}>{phaseLabel(view)}</div>
  </header>

  <section class="main">
    {@render team(view.teams.home, 'home')}

    <div class="center">
      {#if view.phase === 'intermission' && view.intermission}
        <div class="caption">{text.endOf(previousPeriod(view))}</div>
        <Flaps
          value={view.intermission.text}
          width={140}
          height={230}
          size={210}
          flip={animations}
        />
        <div class="caption">{text.next(view)}</div>
      {:else if view.phase === 'shootout' || view.phase === 'final'}
        {@const word = view.phase === 'final' ? text.finalShort : text.shootoutWord}
        <div class="word-card" style:font-size="{fitFontSize(word, 170, 640)}px">{word}</div>
      {:else}
        <div class="clock" class:stopped={!view.clockRunning} class:urgent={lastMinute}>
          <Flaps value={view.clockText} width={150} height={250} size={230} flip={animations} />
        </div>
        {#if view.powerPlay}
          {@const pp = view.teams[view.powerPlay]}
          <div class="powerplay" style:--team={pp.color}>
            {text.powerPlay}
            {pp.shortName} · {pp.skaters}:{view.teams[view.powerPlay === 'home' ? 'away' : 'home']
              .skaters}
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
      {@render penalties(view.teams.home)}
      <div class="middle">
        {#if view.timeout}
          {@const t = view.teams[view.timeout.team]}
          <div class="label">{text.timeout} {t.shortName}</div>
          <Flaps value={view.timeout.text} width={100} height={160} size={150} flip={animations} />
        {:else if view.showShots}
          <div class="label">{text.shotsOnGoal}</div>
          <div class="shots">
            <Flaps
              value={String(view.teams.home.shots)}
              width={84}
              height={136}
              size={124}
              flip={animations}
            />
            <Flaps
              value={String(view.teams.away.shots)}
              width={84}
              height={136}
              size={124}
              flip={animations}
            />
          </div>
        {/if}
      </div>
      {@render penalties(view.teams.away)}
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
    color: #f4ecd6;
    font-family: 'Barlow Condensed', var(--font-ui);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    /* Il pannello del tabellone, con una cornice scura come le vecchie casse. */
    background: linear-gradient(180deg, #1d1f23, #141518);
    box-shadow: inset 0 0 0 18px #0b0c0d;
  }

  header {
    display: flex;
    justify-content: center;
    height: 150px;
    padding-top: 42px;
  }

  .plate {
    padding: 4px 44px;
    border-radius: 12px;
    font-size: 66px;
    line-height: 1.15;
    letter-spacing: 0.08em;
    background: #2c2f34;
    box-shadow: inset 0 0 0 3px rgba(0, 0, 0, 0.55);
  }

  .plate.final {
    color: #ffc845;
  }

  .main,
  .bottom {
    display: grid;
    /* Colonne fisse: il centro non può mai spingere fuori le squadre. */
    grid-template-columns: 520px minmax(0, 1fr) 520px;
    gap: 30px;
    padding: 0 50px;
  }

  .main {
    height: 590px;
  }

  .team {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    min-width: 0;
    transition: opacity 600ms;
  }

  .team.dimmed {
    opacity: 0.4;
  }

  /* Il nome su una targa, con una fascia nel colore della squadra. */
  .name-card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    width: 100%;
    height: 132px;
    padding: 0 20px;
    border-top: 16px solid var(--team);
    border-radius: 12px;
    background: #2c2f34;
    box-shadow: inset 0 0 0 3px rgba(0, 0, 0, 0.55);
  }

  .logo {
    flex: none;
    width: 96px;
    height: 96px;
    object-fit: contain;
  }

  .short {
    min-width: 0;
    overflow: hidden;
    line-height: 1;
    letter-spacing: 0.05em;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .timeouts {
    display: flex;
    gap: 14px;
    height: 48px;
  }

  .to {
    padding: 0 14px;
    border-radius: 8px;
    font-size: 38px;
    line-height: 48px;
    color: #c9c1aa;
    background: #2c2f34;
  }

  .center {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
  }

  /* Tempo fermo: cifre gialle. Ultimo minuto: rosse. */
  .clock.stopped :global(.flap),
  .clock.stopped :global(.sep) {
    color: #ffc845;
  }

  .clock.urgent :global(.flap),
  .clock.urgent :global(.sep) {
    color: #ff5a4a;
  }

  .caption {
    font-size: 50px;
    letter-spacing: 0.06em;
    color: #c9c1aa;
    white-space: nowrap;
  }

  .word-card {
    max-width: 100%;
    padding: 30px 50px;
    border-radius: 16px;
    line-height: 1;
    letter-spacing: 0.08em;
    white-space: nowrap;
    background: linear-gradient(180deg, #3a3d43 0 50%, #2c2f34 50% 100%);
    box-shadow: inset 0 0 0 3px rgba(0, 0, 0, 0.55);
  }

  .powerplay {
    padding: 6px 30px;
    border-left: 16px solid var(--team);
    border-radius: 10px;
    font-size: 58px;
    letter-spacing: 0.04em;
    white-space: nowrap;
    background: #2c2f34;
  }

  .bottom {
    height: 300px;
  }

  .penalties {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .pen {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 88px;
    padding: 0 24px;
    border-left: 12px solid var(--team);
    border-radius: 10px;
    font-size: 78px;
    line-height: 1;
    background: #2c2f34;
  }

  .pen.misconduct {
    height: 66px;
    font-size: 54px;
    opacity: 0.7;
  }

  .player {
    color: #ffc845;
  }

  .waiting {
    padding-left: 24px;
    font-size: 40px;
    color: #c9c1aa;
  }

  .middle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .label {
    font-size: 46px;
    letter-spacing: 0.08em;
    color: #c9c1aa;
    white-space: nowrap;
  }

  .shots {
    display: flex;
    gap: 120px;
  }

  .so {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding-top: 10px;
  }

  .so-title {
    font-size: 54px;
    letter-spacing: 0.08em;
    color: #c9c1aa;
  }

  .so.won .so-title {
    color: #ffc845;
  }

  .so-shots {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
  }

  /* Tessera vuota = da tirare, verde = gol, rossa = sbagliato. */
  .so-shot {
    width: 78px;
    height: 96px;
    border-radius: 10px;
    background: #2c2f34;
    box-shadow: inset 0 0 0 3px rgba(0, 0, 0, 0.55);
  }

  .so-shot.goal {
    background: #2fb45f;
  }

  .so-shot.miss {
    background: #d8443a;
  }
</style>
