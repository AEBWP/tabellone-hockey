<script lang="ts">
  import type { GameView, TeamId, TeamView } from '../../engine'
  import { textColorOn } from '../../shared/color'
  import { boardText, phaseLabel, previousPeriod } from '../../i18n/board'
  import { fitFontSize } from '../../shared/labels'
  import GoalOverlay from './GoalOverlay.svelte'

  /**
   * Stile "Ghiaccio": tabellone chiaro, come la grafica dei tornei
   * internazionali. Fondo bianco-ghiaccio, testi blu notte, colori delle
   * squadre come accento. Disegnato su 1920×1080.
   */
  let { view, animations = true }: { view: GameView; animations?: boolean } = $props()

  const text = $derived(boardText(view))
  const sides: TeamId[] = ['home', 'away']
  const lastMinute = $derived(view.phase === 'play' && view.clockText.includes('.'))
  const winner = $derived.by<TeamId | null>(() => {
    if (view.phase !== 'final') return null
    const { home, away } = view.teams
    return home.score === away.score ? null : home.score > away.score ? 'home' : 'away'
  })

  const caption = $derived.by(() => {
    switch (view.phase) {
      case 'intermission':
        return text.startsInShort(view)
      case 'shootout':
        return text.shootoutGoals
      case 'final':
        return text.result
      case 'ready':
        return text.timeStopped
      default:
        return view.clockRunning ? text.time : text.timeStopped
    }
  })

  const penaltyRows = (t: TeamView) => t.penalties.filter((p) => !p.queued).slice(0, 3)
</script>

<div class="board">
  <div class="bg"></div>

  <header class="head">
    <div class="pill" class:final={view.phase === 'final'}>
      {view.phase === 'intermission' ? text.endOf(previousPeriod(view)) : phaseLabel(view)}
    </div>
  </header>

  <section class="main">
    {#each sides as id, i (id)}
      {@const t = view.teams[id]}
      {#if i === 1}
        <div
          class="clock-card"
          class:running={view.clockRunning && view.phase === 'play'}
          class:urgent={lastMinute}
        >
          <div class="caption">{caption}</div>
          {#if view.phase === 'intermission' && view.intermission}
            <div class="clock pause">{view.intermission.text}</div>
          {:else if view.phase === 'shootout' && view.shootout}
            <div class="clock">
              {view.shootout.home.filter(Boolean).length}<span class="dash">–</span
              >{view.shootout.away.filter(Boolean).length}
            </div>
          {:else if view.phase === 'final'}
            <div class="clock word">{text.finalShort}</div>
          {:else}
            <div class="clock" class:stopped={!view.clockRunning}>{view.clockText}</div>
          {/if}

          {#if view.powerPlay}
            {@const pp = view.teams[view.powerPlay]}
            <div class="pp" style:--team={pp.color} style:--on-team={textColorOn(pp.color)}>
              <span>{text.powerPlay}</span>
              <b>{pp.shortName}</b>
              <span>{view.teams.home.skaters} vs {view.teams.away.skaters}</span>
            </div>
          {/if}
        </div>
      {/if}

      <div
        class="team-card {id}"
        class:dimmed={winner !== null && winner !== id}
        style:--team={t.color}
        style:--on-team={textColorOn(t.color)}
      >
        <div class="band"></div>
        <div class="identity">
          {#if t.logo}
            <div class="logo"><img src={t.logo} alt="" /></div>
          {/if}
          <div class="names">
            <span
              class="short"
              style:font-size="{fitFontSize(t.shortName, 84, t.logo ? 330 : 470)}px"
              >{t.shortName}</span
            >
            <span class="full">{t.name}</span>
          </div>
        </div>
        <div class="score">{t.score}</div>
        <div class="tos">
          {#each { length: Math.max(1, t.timeoutsLeft) }, k (k)}
            <i class:on={k < t.timeoutsLeft}></i>
          {/each}
          <span>{text.timeout}</span>
        </div>
      </div>
    {/each}
  </section>

  <section class="bottom">
    {#each sides as id, i (id)}
      {@const t = view.teams[id]}
      {#if i === 1}
        {#if view.timeout}
          {@const tt = view.teams[view.timeout.team]}
          <div class="card timeout" style:--team={tt.color} style:--on-team={textColorOn(tt.color)}>
            <div class="card-head">{text.timeout} {tt.shortName}</div>
            <div class="timeout-clock">{view.timeout.text}</div>
          </div>
        {:else}
          <div class="card shots" style:visibility={view.showShots ? null : 'hidden'}>
            <div class="card-head">{text.shotsOnGoal}</div>
            <div class="shots-row">
              {#each sides as s (s)}
                <div class="shot" style:--team={view.teams[s].color}>
                  <b>{view.teams[s].shots}</b>
                  <span>{view.teams[s].shortName}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/if}

      <div class="card pens" style:--team={t.color}>
        {#if view.shootout}
          {@const shots = view.shootout[id]}
          <div class="card-head">
            <i class="sq"></i>{text.shootout} <b>{shots.filter(Boolean).length}</b>
          </div>
          <div class="so">
            {#each { length: Math.max(view.shootout.rounds, shots.length) }, k (k)}
              <span class="dot" class:goal={shots[k] === true} class:miss={shots[k] === false}
              ></span>
            {/each}
          </div>
        {:else}
          {@const rows = penaltyRows(t)}
          {@const waiting = t.penalties.length - rows.length}
          <div class="card-head">
            <i class="sq"></i>{text.penalties}
            {#if waiting > 0}<b class="waiting">{text.waiting(waiting).toLowerCase()}</b>{/if}
          </div>
          <div class="rows">
            {#each rows as p (p.id)}
              <div class="row" class:misconduct={!p.countsForStrength}>
                <span class="num">#{p.player}</span>
                <span class="time">{p.text}</span>
              </div>
            {:else}
              <div class="none">{text.noPenalties}</div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </section>

  {#if animations}
    <GoalOverlay {view} />
  {/if}
</div>

<style>
  .board {
    --navy: #0d2240;
    --slate: #5d7290;
    --card: #ffffff;
    --line: #d7e3ef;

    position: relative;
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    color: var(--navy);
    font-family: 'Barlow Condensed', var(--font-ui);
    font-variant-numeric: tabular-nums;
    background: #e3edf7;
  }

  /* Fondo ghiaccio: luce dall'alto e graffi appena visibili */
  .bg {
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(-24deg, rgba(255, 255, 255, 0.35) 0 1px, transparent 1px 46px),
      repeating-linear-gradient(32deg, rgba(255, 255, 255, 0.25) 0 1px, transparent 1px 63px),
      radial-gradient(ellipse 90% 60% at 50% 0%, #ffffff 0%, #eaf2fa 45%, #cfdeee 100%);
  }

  .dimmed {
    opacity: 0.45;
  }

  .head,
  .main,
  .bottom {
    position: relative;
  }

  .head {
    display: flex;
    justify-content: center;
    height: 118px;
    padding-top: 30px;
  }

  .pill {
    padding: 10px 60px 6px;
    border-radius: 999px;
    font-size: 54px;
    font-weight: 700;
    letter-spacing: 0.16em;
    line-height: 1;
    color: #fff;
    background: var(--navy);
    box-shadow: 0 10px 24px rgba(13, 34, 64, 0.25);
  }

  .pill.final {
    background: #c99a2e;
  }

  /* ── Riga principale ──────────────────────────────────────────── */
  .main {
    display: grid;
    grid-template-columns: 560px minmax(0, 1fr) 560px;
    gap: 32px;
    height: 600px;
    padding: 6px 40px 0;
  }

  .team-card,
  .clock-card,
  .card {
    position: relative;
    border-radius: 22px;
    background: var(--card);
    box-shadow:
      0 18px 40px rgba(13, 34, 64, 0.14),
      0 2px 0 rgba(255, 255, 255, 0.9) inset;
    overflow: hidden;
  }

  .team-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 30px 30px 22px;
  }

  .band {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 20px;
    background: var(--team);
  }

  .identity {
    display: flex;
    align-items: center;
    gap: 22px;
    max-width: 100%;
    margin-top: 10px;
  }

  .away .identity {
    flex-direction: row-reverse;
  }

  .logo {
    display: grid;
    flex: none;
    place-items: center;
    width: 132px;
    height: 132px;
    padding: 14px;
    border: 6px solid var(--team);
    border-radius: 50%;
    background: #fff;
  }

  .logo img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .names {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .away .names {
    align-items: flex-end;
  }

  .short {
    overflow: hidden;
    font-weight: 800;
    line-height: 0.95;
    letter-spacing: 0.03em;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .full {
    overflow: hidden;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--slate);
  }

  .score {
    display: grid;
    flex: 1;
    place-items: center;
    font-size: 290px;
    font-weight: 800;
    line-height: 1;
  }

  .tos {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--slate);
  }

  .tos i {
    width: 34px;
    height: 10px;
    border-radius: 5px;
    background: var(--line);
  }

  .tos i.on {
    background: var(--team);
  }

  /* Tempo */
  .clock-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 0;
    border-bottom: 12px solid #f2a33a;
  }

  .clock-card.running {
    border-bottom-color: #22b765;
  }

  .clock-card.urgent {
    border-bottom-color: #e5383b;
  }

  .caption {
    font-size: 34px;
    font-weight: 700;
    letter-spacing: 0.3em;
    color: var(--slate);
  }

  .clock {
    font-size: 250px;
    font-weight: 800;
    line-height: 0.95;
    white-space: nowrap;
  }

  .clock.stopped {
    color: #c77a12;
  }

  .urgent .clock {
    color: #d62828;
  }

  .clock.pause {
    font-size: 220px;
    color: #2c6aa3;
  }

  .clock.word {
    font-size: 170px;
    letter-spacing: 0.06em;
  }

  .dash {
    margin: 0 0.1em;
    color: var(--slate);
  }

  .pp {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-top: 14px;
    padding: 8px 26px 6px;
    border-radius: 999px;
    font-size: 40px;
    font-weight: 700;
    letter-spacing: 0.06em;
    white-space: nowrap;
    color: var(--on-team);
    background: var(--team);
  }

  /* ── Riga in basso ────────────────────────────────────────────── */
  .bottom {
    display: grid;
    grid-template-columns: 560px minmax(0, 1fr) 560px;
    gap: 32px;
    height: 300px;
    padding: 30px 40px 40px;
  }

  .card {
    display: flex;
    flex-direction: column;
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 26px 10px;
    font-size: 32px;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: var(--slate);
    border-bottom: 2px solid var(--line);
  }

  .card-head b {
    margin-left: auto;
    letter-spacing: 0.04em;
    color: var(--navy);
  }

  .waiting {
    font-size: 26px;
    color: #c77a12 !important;
  }

  .sq {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: var(--team);
  }

  .rows {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-around;
    padding: 4px 26px;
  }

  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-weight: 800;
    line-height: 1;
  }

  .num {
    font-size: 64px;
  }

  .time {
    font-size: 72px;
    color: #c77a12;
  }

  .row.misconduct {
    opacity: 0.6;
  }

  .row.misconduct .num,
  .row.misconduct .time {
    font-size: 50px;
  }

  .none {
    margin: auto;
    font-size: 32px;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: #a9bacd;
  }

  .shots-row {
    display: grid;
    flex: 1;
    grid-template-columns: 1fr 1fr;
  }

  .shot {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-top: 6px solid var(--team);
    margin: 0 30px;
  }

  .shot b {
    font-size: 120px;
    line-height: 1;
  }

  .shot span {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: var(--slate);
  }

  .timeout {
    border: 6px solid var(--team);
  }

  .timeout .card-head {
    color: var(--on-team);
    background: var(--team);
    border-bottom: 0;
  }

  .timeout-clock {
    display: grid;
    flex: 1;
    place-items: center;
    font-size: 140px;
    font-weight: 800;
    color: #c77a12;
  }

  .so {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    gap: 20px;
  }

  .dot {
    width: 80px;
    height: 80px;
    border: 6px solid var(--line);
    border-radius: 50%;
  }

  .dot.goal {
    border-color: #22b765;
    background: #22b765;
  }

  .dot.miss {
    border-color: #e5383b;
    background: #e5383b;
  }
</style>
