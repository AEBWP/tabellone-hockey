<script lang="ts">
  import type { GameView, TeamId, TeamView } from '../../engine'
  import { textColorOn } from '../../shared/color'
  import { boardText, phaseLabel } from '../../i18n/board'
  import { fitFontSize } from '../../shared/labels'
  import GoalOverlay from './GoalOverlay.svelte'

  /**
   * Stile "Broadcast": grafica piatta da diretta TV. Colori pieni, punteggi
   * su riquadri bianchi, nessun bagliore. Disegnato su 1920×1080.
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

  /** Periodo in forma breve per il riquadro centrale: "1°", "OT", "OT2", "SO". */
  const periodShort = $derived.by(() => {
    if (view.phase === 'shootout' || view.shootout)
      return { big: text.shootoutShort, small: text.shootoutAbbr }
    if (view.periodKind === 'overtime') {
      const big = text.overtimeShort + (view.overtimeNumber > 1 ? view.overtimeNumber : '')
      return { big, small: text.overtimeAbbr }
    }
    return { big: text.periodNumber(view.period), small: text.periodWord(view.regularPeriods) }
  })

  const caption = $derived.by(() => {
    switch (view.phase) {
      case 'intermission':
        return text.intermissionThen(view)
      case 'shootout':
        return text.shootout
      case 'final':
        return phaseLabel(view)
      default:
        return text.period(view)
    }
  })

  const status = $derived.by(() => {
    if (view.phase === 'play' && view.clockRunning) return { text: text.live, cls: 'live' }
    if (view.phase === 'play' || view.phase === 'ready') return { text: text.stopped, cls: 'stop' }
    return null
  })

  const penaltyRows = (t: TeamView) => t.penalties.filter((p) => !p.queued).slice(0, 3)
</script>

<div class="board">
  <!-- ── Barra superiore: squadre, punteggi e periodo ────────────── -->
  <section class="bar">
    {#snippet teamBlock(id: TeamId)}
      {@const t = view.teams[id]}
      <div
        class="team {id}"
        class:dimmed={winner !== null && winner !== id}
        style:--team={t.color}
        style:--on-team={textColorOn(t.color)}
      >
        {#if t.logo}
          <div class="logo"><img src={t.logo} alt="" /></div>
        {/if}
        <div class="names">
          <span class="short" style:font-size="{fitFontSize(t.shortName, 96, t.logo ? 300 : 470)}px"
            >{t.shortName}</span
          >
          <span class="full">{t.name}</span>
          <span class="tos">
            {#each { length: Math.max(1, t.timeoutsLeft) }, i (i)}
              <i class:on={i < t.timeoutsLeft}></i>
            {/each}
            <b>{text.timeout}</b>
          </span>
        </div>
      </div>
    {/snippet}
    {#snippet scoreBlock(id: TeamId)}
      <div class="score {id}" class:dimmed={winner !== null && winner !== id}>
        {view.teams[id].score}
      </div>
    {/snippet}

    {@render teamBlock('home')}
    {@render scoreBlock('home')}
    <div class="period">
      <span class="period-big">{periodShort.big}</span>
      <span class="period-small">{periodShort.small}</span>
    </div>
    {@render scoreBlock('away')}
    {@render teamBlock('away')}
  </section>

  <!-- ── Centro: penalità, tempo, penalità ─────────────────────────── -->
  <section class="middle">
    {#each sides as id, i (id)}
      {@const t = view.teams[id]}
      {#if i === 1}
        <div class="clock-box" class:urgent={lastMinute}>
          <div class="clock-head">
            <span>{caption}</span>
            {#if status}<span class="status {status.cls}">{status.text}</span>{/if}
          </div>
          {#if view.phase === 'intermission' && view.intermission}
            <div class="clock intermission">{view.intermission.text}</div>
          {:else if view.phase === 'shootout' && view.shootout}
            <!-- Un solo elemento dentro la griglia, così il punteggio resta su una riga. -->
            <div class="clock">
              <span
                >{view.shootout.home.filter(Boolean).length}<span class="dash">–</span
                >{view.shootout.away.filter(Boolean).length}</span
              >
            </div>
          {:else if view.phase === 'final'}
            <div class="clock word">{text.finalShort}</div>
          {:else}
            <div class="clock" class:stopped={!view.clockRunning}>{view.clockText}</div>
          {/if}
        </div>
      {/if}

      <div class="side {id}" style:--team={t.color} style:--on-team={textColorOn(t.color)}>
        {#if view.shootout}
          {@const shots = view.shootout[id]}
          <div class="side-head">{text.shootout} <b>{shots.filter(Boolean).length}</b></div>
          <div class="so">
            {#each { length: Math.max(view.shootout.rounds, shots.length) }, k (k)}
              <span class="so-dot" class:goal={shots[k] === true} class:miss={shots[k] === false}
              ></span>
            {/each}
          </div>
        {:else}
          {@const rows = penaltyRows(t)}
          {@const waiting = t.penalties.length - rows.length}
          <div class="side-head">
            {text.penalties}
            {#if waiting > 0}<b class="waiting">+{waiting}</b>{/if}
          </div>
          <div class="pens">
            {#each rows as p (p.id)}
              <div class="pen" class:misconduct={!p.countsForStrength}>
                <span class="pen-num">{p.player}</span>
                <span class="pen-time">{p.text}</span>
              </div>
            {:else}
              <div class="pen-none">{text.none}</div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </section>

  <!-- ── Riga in basso: superiorità, tiri / timeout ─────────────────── -->
  <section class="foot">
    {#each sides as id, i (id)}
      {@const t = view.teams[id]}
      {#if i === 1}
        {#if view.timeout}
          {@const tt = view.teams[view.timeout.team]}
          <div class="timeout" style:--team={tt.color} style:--on-team={textColorOn(tt.color)}>
            <span class="timeout-label">{text.timeout} {tt.shortName}</span>
            <span class="timeout-clock">{view.timeout.text}</span>
          </div>
        {:else}
          <div class="shots">
            <span class="shots-val">{view.teams.home.shots}</span>
            <span class="shots-label">{text.shotsOnGoal}</span>
            <span class="shots-val">{view.teams.away.shots}</span>
          </div>
        {/if}
      {/if}
      <div class="pp-slot {id}">
        {#if view.powerPlay === id}
          <div class="pp" style:--team={t.color} style:--on-team={textColorOn(t.color)}>
            <span class="pp-label">{text.powerPlay}</span>
            <span class="pp-strength">{view.teams.home.skaters} vs {view.teams.away.skaters}</span>
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
    --ink: #0b0d12;
    --paper: #f3f5f8;
    --grey: #1a1e27;
    --grey-2: #232835;
    --muted: #9aa6b8;

    position: relative;
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    color: #fff;
    font-family: 'Barlow Condensed', var(--font-ui);
    font-variant-numeric: tabular-nums;
    background: linear-gradient(180deg, #12151c 0%, #090b0f 100%);
  }

  .dimmed {
    opacity: 0.38;
  }

  /* ── Barra superiore ──────────────────────────────────────────── */
  .bar {
    position: absolute;
    left: 40px;
    right: 40px;
    top: 44px;
    height: 300px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 260px 200px 260px minmax(0, 1fr);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  }

  .team {
    display: flex;
    align-items: center;
    gap: 28px;
    min-width: 0;
    padding: 0 30px;
    color: var(--on-team);
    background: var(--team);
    border-bottom: 10px solid rgba(0, 0, 0, 0.22);
  }

  .team.away {
    flex-direction: row-reverse;
    text-align: right;
  }

  .logo {
    display: grid;
    flex: none;
    place-items: center;
    width: 170px;
    height: 170px;
    border-radius: 50%;
    background: #fff;
    padding: 20px;
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
    font-size: 96px;
    font-weight: 800;
    line-height: 0.92;
    letter-spacing: 0.02em;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .full {
    overflow: hidden;
    font-size: 32px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
    text-overflow: ellipsis;
    opacity: 0.85;
  }

  .tos {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
  }

  .away .tos {
    flex-direction: row-reverse;
  }

  .tos i {
    width: 18px;
    height: 18px;
    border: 3px solid currentColor;
    border-radius: 50%;
    opacity: 0.45;
  }

  .tos i.on {
    background: currentColor;
    opacity: 1;
  }

  .tos b {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.2em;
    opacity: 0.75;
  }

  .score {
    display: grid;
    place-items: center;
    font-size: 240px;
    font-weight: 800;
    line-height: 1;
    color: var(--ink);
    background: var(--paper);
    border-bottom: 10px solid #c9d0db;
  }

  .period {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--ink);
    border-bottom: 10px solid #000;
  }

  .period-big {
    font-size: 120px;
    font-weight: 800;
    line-height: 0.9;
  }

  .period-small {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: var(--muted);
  }

  /* ── Centro ───────────────────────────────────────────────────── */
  .middle {
    position: absolute;
    left: 40px;
    right: 40px;
    top: 384px;
    height: 420px;
    display: grid;
    grid-template-columns: 500px minmax(0, 1fr) 500px;
    gap: 36px;
  }

  .clock-box {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: #000;
    border-top: 8px solid #fff;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  }

  .clock-box.urgent {
    border-top-color: #ff3b3b;
  }

  .clock-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 28px 0;
    font-size: 34px;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--muted);
  }

  .status {
    padding: 4px 16px 2px;
    font-size: 26px;
    letter-spacing: 0.14em;
    color: var(--ink);
  }

  .status.live {
    background: #2fd27a;
  }

  .status.stop {
    background: #ffb627;
  }

  .clock {
    display: grid;
    flex: 1;
    place-items: center;
    font-size: 270px;
    font-weight: 800;
    line-height: 1;
    white-space: nowrap;
  }

  .clock.stopped {
    color: #ffb627;
  }

  .urgent .clock {
    color: #ff3b3b;
  }

  .clock.intermission {
    font-size: 240px;
    color: #9cc3ea;
  }

  .clock.word {
    font-size: 190px;
    letter-spacing: 0.06em;
  }

  .dash {
    margin: 0 0.1em;
    color: var(--muted);
  }

  .side {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--grey);
  }

  .side-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px 8px;
    font-size: 34px;
    font-weight: 800;
    letter-spacing: 0.18em;
    color: var(--on-team);
    background: var(--team);
  }

  .side-head b {
    letter-spacing: 0;
  }

  .waiting {
    padding: 0 12px;
    color: var(--ink);
    background: #ffb627;
  }

  .pens {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }

  .pen {
    display: flex;
    flex: 1;
    max-height: 104px;
    align-items: stretch;
    font-weight: 800;
    line-height: 1;
  }

  .pen-num {
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    width: 150px;
    font-size: 64px;
    color: var(--ink);
    background: var(--paper);
  }

  .pen-num::before {
    content: '#';
    font-size: 0.6em;
  }

  .pen-time {
    display: grid;
    flex: 1;
    place-items: center end;
    padding-right: 26px;
    font-size: 84px;
    background: var(--grey-2);
  }

  .pen.misconduct {
    opacity: 0.7;
  }

  .pen.misconduct .pen-time,
  .pen.misconduct .pen-num {
    font-size: 54px;
  }

  .pen-none {
    display: grid;
    flex: 1;
    place-items: center;
    font-size: 36px;
    font-weight: 700;
    letter-spacing: 0.3em;
    color: #3a4252;
  }

  .so {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    gap: 20px;
    padding: 16px;
  }

  .so-dot {
    width: 92px;
    height: 92px;
    border: 6px solid #3a4252;
    border-radius: 50%;
  }

  .so-dot.goal {
    border-color: #2fd27a;
    background: #2fd27a;
  }

  .so-dot.miss {
    border-color: #ff3b3b;
    background: #ff3b3b;
  }

  /* ── Riga in basso ────────────────────────────────────────────── */
  .foot {
    position: absolute;
    left: 40px;
    right: 40px;
    top: 840px;
    height: 196px;
    display: grid;
    grid-template-columns: 500px minmax(0, 1fr) 500px;
    gap: 36px;
  }

  .shots {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    background: var(--grey);
    border-bottom: 8px solid #000;
  }

  .shots-val {
    font-size: 130px;
    font-weight: 800;
    line-height: 1;
    text-align: center;
  }

  .shots-label {
    font-size: 34px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-align: center;
    color: var(--muted);
  }

  .timeout {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
    color: var(--on-team);
    background: var(--team);
    animation: slide-up 300ms ease-out;
  }

  .timeout-label {
    font-size: 54px;
    font-weight: 800;
    letter-spacing: 0.12em;
  }

  .timeout-clock {
    padding: 4px 26px 0;
    font-size: 120px;
    font-weight: 800;
    color: var(--ink);
    background: var(--paper);
  }

  .pp-slot {
    display: flex;
    align-items: center;
  }

  .pp-slot.away {
    justify-content: flex-end;
  }

  .pp {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    justify-content: center;
    padding: 0 30px;
    color: var(--on-team);
    background: var(--team);
    animation: slide-up 300ms ease-out;
  }

  .pp-label {
    font-size: 50px;
    font-weight: 800;
    letter-spacing: 0.12em;
  }

  .pp-strength {
    font-size: 90px;
    font-weight: 800;
    line-height: 1;
  }

  @keyframes slide-up {
    from {
      transform: translateY(30px);
      opacity: 0;
    }
  }
</style>
