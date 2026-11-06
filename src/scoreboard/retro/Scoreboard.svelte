<script lang="ts">
  import type { GameView, TeamId, TeamView } from '../../engine'
  import { boardText } from '../../i18n/board'
  import { fitFontSize } from '../../shared/labels'
  import GoalOverlay from './GoalOverlay.svelte'
  import PixelLogo from './PixelLogo.svelte'
  import SevenSegment from './SevenSegment.svelte'

  /**
   * Stile "Retrò": il vecchio tabellone a lampadine. Cifre a 7 segmenti,
   * scritte a matrice di punti, pochi colori accesi su fondo nero.
   * Disegnato su 1920×1080.
   */
  let { view, animations = true }: { view: GameView; animations?: boolean } = $props()
  const text = $derived(boardText(view))

  const RED = '#ff3b2f'
  const AMBER = '#ffb000'
  const GREEN = '#3dff7a'

  const sides: TeamId[] = ['home', 'away']
  const lastMinute = $derived(view.phase === 'play' && view.clockText.includes('.'))
  const winner = $derived.by<TeamId | null>(() => {
    if (view.phase !== 'final') return null
    const { home, away } = view.teams
    return home.score === away.score ? null : home.score > away.score ? 'home' : 'away'
  })

  /** Colore della scritta di squadra: il colore della squadra, schiarito come una lampadina accesa. */
  const lamp = (t: TeamView) => `color-mix(in srgb, ${t.color} 70%, white)`
  const pad = (v: string | number, n: number) => String(v).padStart(n, ' ')
  const penaltyRows = (t: TeamView) => t.penalties.filter((p) => !p.queued).slice(0, 2)

  const periodText = $derived.by(() => {
    if (view.phase === 'shootout' || view.shootout) return text.shootoutShort
    if (view.periodKind === 'overtime')
      return text.overtimeShort + (view.overtimeNumber > 1 ? view.overtimeNumber : '')
    return String(view.period)
  })
</script>

<div class="board">
  <div class="bulbs"></div>

  <section class="top">
    {#each sides as id, i (id)}
      {@const t = view.teams[id]}
      {#if i === 1}
        <!-- Centro: tempo e periodo -->
        <div class="center">
          {#if view.phase === 'intermission' && view.intermission}
            <div class="label green">{text.intermission}</div>
            <SevenSegment value={pad(view.intermission.text, 5)} height={210} color={GREEN} />
          {:else if view.phase === 'shootout' && view.shootout}
            <div class="label">{text.shootout}</div>
            <SevenSegment
              value={`${view.shootout.home.filter(Boolean).length}-${view.shootout.away.filter(Boolean).length}`}
              height={210}
              color={AMBER}
            />
          {:else if view.phase === 'final'}
            <div class="label">{text.time}</div>
            <div class="final blink">{text.finalShort}</div>
          {:else}
            <div class="label">{text.time}</div>
            <SevenSegment
              value={pad(view.clockText, 5)}
              height={210}
              color={lastMinute ? RED : AMBER}
            />
          {/if}
          <div class="period">
            <span class="label small">{text.periodWord(view.regularPeriods)}</span>
            {#if /^\d$/.test(periodText)}
              <SevenSegment value={periodText} height={96} color={AMBER} />
            {:else}
              <span class="period-word">{periodText}</span>
            {/if}
          </div>
        </div>
      {/if}

      <div class="team {id}" class:dimmed={winner !== null && winner !== id}>
        <div class="name" style:color={lamp(t)}>
          {#if t.logo}<PixelLogo src={t.logo} size={84} pixels={20} />{/if}
          <span style:font-size="{fitFontSize(t.shortName, 92, t.logo ? 440 : 540)}px"
            >{t.shortName}</span
          >
        </div>
        <SevenSegment value={pad(t.score, 2)} height={300} color={RED} />
        <div class="tos">
          <span class="label small">{text.timeout}</span>
          {#each { length: Math.max(1, t.timeoutsLeft) }, k (k)}
            <span class="bulb" class:on={k < t.timeoutsLeft}></span>
          {/each}
        </div>
      </div>
    {/each}
  </section>

  {#if view.powerPlay}
    {@const pp = view.teams[view.powerPlay]}
    <div class="pp" style:color={lamp(pp)}>
      {text.powerPlay}
      {pp.shortName} · {text.strength(view.teams.home.skaters, view.teams.away.skaters)}
    </div>
  {/if}

  <section class="bottom">
    {#each sides as id, i (id)}
      {@const t = view.teams[id]}
      {#if i === 1}
        <div class="mid" style:visibility={view.timeout || view.showShots ? null : 'hidden'}>
          {#if view.timeout}
            {@const tt = view.teams[view.timeout.team]}
            <div class="label blink" style:color={lamp(tt)}>{text.timeout} {tt.shortName}</div>
            <SevenSegment value={pad(view.timeout.text, 4)} height={130} color={AMBER} />
          {:else}
            <div class="label">
              {text.shotsOnGoal}
            </div>
            <div class="shots">
              <SevenSegment value={pad(view.teams.home.shots, 2)} height={120} color={AMBER} />
              <SevenSegment value={pad(view.teams.away.shots, 2)} height={120} color={AMBER} />
            </div>
          {/if}
        </div>
      {/if}

      <div class="pens {id}">
        {#if view.shootout}
          {@const shots = view.shootout[id]}
          <div class="label">{text.shootout} {t.shortName}</div>
          <div class="so">
            {#each { length: Math.max(view.shootout.rounds, shots.length) }, k (k)}
              <span class="bulb big" class:goal={shots[k] === true} class:miss={shots[k] === false}
              ></span>
            {/each}
          </div>
        {:else}
          {@const rows = penaltyRows(t)}
          {@const waiting = t.penalties.length - rows.length}
          <div class="label">
            {text.penalties}
            {#if waiting > 0}<span class="waiting">+{waiting}</span>{/if}
          </div>
          {#each [0, 1] as r (r)}
            {@const p = rows[r]}
            <div class="pen-row">
              <SevenSegment
                value={p ? pad(p.player, 2) : '88'}
                ghost={!p}
                height={84}
                color={RED}
              />
              <SevenSegment
                value={p ? pad(p.text, 4) : '8:88'}
                ghost={!p}
                height={84}
                color={AMBER}
              />
            </div>
          {/each}
        {/if}
      </div>
    {/each}
  </section>

  <div class="caption">{view.phase === 'intermission' ? text.next(view) : ''}</div>

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
    color: #ffb000;
    font-family: 'Doto', monospace;
    font-weight: 900;
    background: #050505;
    /* Cornice metallica del tabellone */
    box-shadow:
      inset 0 0 0 14px #1d1d1d,
      inset 0 0 0 18px #3a3a3a,
      inset 0 0 0 22px #0d0d0d;
  }

  /* Trama di lampadine spente sul fondo */
  .bulbs {
    position: absolute;
    inset: 22px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.045) 2px, transparent 2.6px) 0 0 /
      14px 14px;
  }

  .label {
    font-size: 42px;
    letter-spacing: 0.12em;
    color: #ffb000;
    text-shadow: 0 0 12px rgba(255, 176, 0, 0.6);
  }

  .label.small {
    font-size: 30px;
  }

  .label.green {
    color: #3dff7a;
    text-shadow: 0 0 12px rgba(61, 255, 122, 0.6);
  }

  .dimmed {
    opacity: 0.35;
  }

  .blink {
    animation: blink 1.1s steps(2, start) infinite;
  }

  @keyframes blink {
    to {
      visibility: hidden;
    }
  }

  /* ── Parte alta ───────────────────────────────────────────────── */
  .top {
    position: absolute;
    left: 50px;
    right: 50px;
    top: 50px;
    height: 600px;
    display: grid;
    grid-template-columns: 560px minmax(0, 1fr) 560px;
    gap: 30px;
  }

  .team,
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    padding-top: 10px;
  }

  .name {
    display: flex;
    align-items: center;
    gap: 22px;
    height: 110px;
    text-shadow: 0 0 16px currentColor;
    white-space: nowrap;
  }

  .tos {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .bulb {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(255, 176, 0, 0.12);
  }

  .bulb.on {
    background: #ffb000;
    box-shadow:
      0 0 10px #ffb000,
      0 0 24px rgba(255, 176, 0, 0.6);
  }

  .center {
    padding-top: 40px;
    border: 4px solid #2a2a2a;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.55);
  }

  .final {
    font-size: 190px;
    line-height: 1.1;
    color: #ffb000;
    text-shadow: 0 0 20px rgba(255, 176, 0, 0.7);
  }

  .period {
    display: flex;
    align-items: center;
    gap: 26px;
    margin-top: 6px;
  }

  .period-word {
    font-size: 96px;
    line-height: 1;
    color: #ffb000;
    text-shadow: 0 0 16px rgba(255, 176, 0, 0.7);
  }

  .pp {
    position: absolute;
    left: 0;
    right: 0;
    top: 662px;
    font-size: 46px;
    letter-spacing: 0.1em;
    text-align: center;
    text-shadow: 0 0 14px currentColor;
    animation: blink 1.6s steps(2, start) infinite;
  }

  /* ── Parte bassa ──────────────────────────────────────────────── */
  .bottom {
    position: absolute;
    left: 50px;
    right: 50px;
    top: 735px;
    height: 290px;
    display: grid;
    grid-template-columns: 560px minmax(0, 1fr) 560px;
    gap: 30px;
  }

  .pens,
  .mid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 14px 0;
    border: 4px solid #2a2a2a;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.55);
  }

  .waiting {
    color: #ff3b2f;
  }

  .pen-row {
    display: flex;
    align-items: center;
    gap: 60px;
  }

  .shots {
    display: flex;
    gap: 120px;
    margin-top: 16px;
  }

  .so {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 22px;
  }

  .bulb.big {
    width: 70px;
    height: 70px;
    background: rgba(255, 255, 255, 0.07);
  }

  .bulb.goal {
    background: #3dff7a;
    box-shadow: 0 0 22px #3dff7a;
  }

  .bulb.miss {
    background: #ff3b2f;
    box-shadow: 0 0 22px #ff3b2f;
  }

  .caption {
    position: absolute;
    left: 0;
    right: 0;
    top: 662px;
    font-size: 40px;
    letter-spacing: 0.12em;
    text-align: center;
    color: #3dff7a;
    text-shadow: 0 0 12px rgba(61, 255, 122, 0.6);
  }
</style>
