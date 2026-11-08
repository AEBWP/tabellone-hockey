<script lang="ts">
  import type { GameView, TeamId, TeamView } from '../../engine'
  import { boardText, phaseLabel } from '../../i18n/board'
  import SevenSegment from '../retro/SevenSegment.svelte'
  import AlphaSegment from './AlphaSegment.svelte'
  import GoalOverlay from './GoalOverlay.svelte'
  import { fitSegmentHeight } from './segments'

  /**
   * Stile "LED": tutto a segmenti luminosi su fondo nero, cifre a 7 segmenti e
   * scritte a 14. Colori pieni e niente sfocature: nitido da lontano e leggero
   * anche sui PC meno potenti. Disegnato su 1920×1080.
   */
  let { view, animations = true }: { view: GameView; animations?: boolean } = $props()
  const text = $derived(boardText(view))

  const RED = '#ff2a1f'
  const AMBER = '#ffb000'
  const GREEN = '#35ff6e'
  const WHITE = '#f2f6ff'

  const sides: TeamId[] = ['home', 'away']
  const lastMinute = $derived(view.phase === 'play' && view.clockText.includes('.'))
  const clockColor = $derived(lastMinute ? RED : view.clockRunning ? GREEN : AMBER)
  const winner = $derived.by<TeamId | null>(() => {
    if (view.phase !== 'final') return null
    const { home, away } = view.teams
    return home.score === away.score ? null : home.score > away.score ? 'home' : 'away'
  })

  const lamp = (t: TeamView) => `color-mix(in srgb, ${t.color} 55%, white)`
  const pad = (v: string | number, n: number) => String(v).padStart(n, ' ')
  const penaltyRows = (t: TeamView) => t.penalties.filter((p) => !p.queued).slice(0, 2)

  const strip = $derived.by(() => {
    if (view.powerPlay) {
      const pp = view.teams[view.powerPlay]
      return {
        text: `${text.powerPlay} ${pp.shortName} ${view.teams.home.skaters}:${view.teams.away.skaters}`,
        color: lamp(pp),
      }
    }
    return view.phase === 'intermission' ? { text: text.next(view), color: GREEN } : null
  })
</script>

<div class="board">
  <section class="top">
    {#each sides as id, i (id)}
      {@const t = view.teams[id]}
      {#if i === 1}
        <div class="center">
          {#if view.phase !== 'final'}
            <AlphaSegment
              text={phaseLabel(view)}
              height={fitSegmentHeight(phaseLabel(view), 84, 650)}
              color={WHITE}
            />
          {/if}
          {#if view.phase === 'intermission' && view.intermission}
            <SevenSegment
              value={pad(view.intermission.text, 5)}
              height={250}
              color={GREEN}
              slanted={false}
            />
          {:else if view.shootout}
            <SevenSegment
              value={`${view.shootout.home.filter(Boolean).length}-${view.shootout.away.filter(Boolean).length}`}
              height={250}
              color={AMBER}
              slanted={false}
            />
          {:else if view.phase === 'final'}
            <AlphaSegment
              text={text.finalShort}
              height={fitSegmentHeight(text.finalShort, 210, 650)}
              color={AMBER}
            />
          {:else}
            <SevenSegment
              value={pad(view.clockText, 5)}
              height={250}
              color={clockColor}
              slanted={false}
            />
          {/if}
        </div>
      {/if}

      <div class="team" class:dimmed={winner !== null && winner !== id}>
        <div class="name">
          {#if t.logo}<img class="logo" src={t.logo} alt="" />{/if}
          <AlphaSegment
            text={t.shortName}
            height={fitSegmentHeight(t.shortName, 104, t.logo ? 460 : 570)}
            color={lamp(t)}
          />
        </div>
        <SevenSegment value={pad(t.score, 2)} height={400} color={RED} slanted={false} />
        <div class="tos">
          {#each { length: Math.max(1, t.timeoutsLeft) }, k (k)}
            <span class="lamp" class:on={k < t.timeoutsLeft}></span>
          {/each}
        </div>
      </div>
    {/each}
  </section>

  <div class="strip">
    {#if strip}
      <AlphaSegment
        text={strip.text}
        height={fitSegmentHeight(strip.text, 66, 1820)}
        color={strip.color}
      />
    {/if}
  </div>

  <section class="bottom">
    {#each sides as id, i (id)}
      {@const t = view.teams[id]}
      {#if i === 1}
        <div class="panel mid" style:visibility={view.timeout || view.showShots ? null : 'hidden'}>
          {#if view.timeout}
            {@const tt = view.teams[view.timeout.team]}
            {@const label = `${text.timeout} ${tt.shortName}`}
            <AlphaSegment text={label} height={fitSegmentHeight(label, 56, 630)} color={lamp(tt)} />
            <SevenSegment
              value={pad(view.timeout.text, 4)}
              height={190}
              color={AMBER}
              slanted={false}
            />
          {:else}
            <AlphaSegment
              text={text.shotsOnGoal}
              height={fitSegmentHeight(text.shotsOnGoal, 56, 630)}
              color={WHITE}
            />
            <div class="shots">
              <SevenSegment
                value={pad(view.teams.home.shots, 2)}
                height={190}
                color={AMBER}
                slanted={false}
              />
              <SevenSegment
                value={pad(view.teams.away.shots, 2)}
                height={190}
                color={AMBER}
                slanted={false}
              />
            </div>
          {/if}
        </div>
      {/if}

      <div class="panel">
        {#if view.shootout}
          {@const shots = view.shootout[id]}
          <AlphaSegment
            text={text.shootout}
            height={fitSegmentHeight(text.shootout, 56, 550)}
            color={WHITE}
          />
          <div class="so">
            {#each { length: Math.max(view.shootout.rounds, shots.length) }, k (k)}
              <span class="lamp big" class:goal={shots[k] === true} class:miss={shots[k] === false}
              ></span>
            {/each}
          </div>
        {:else}
          {@const rows = penaltyRows(t)}
          {@const waiting = t.penalties.length - rows.length}
          {@const label = waiting > 0 ? `${text.penalties} +${waiting}` : text.penalties}
          <AlphaSegment text={label} height={fitSegmentHeight(label, 56, 550)} color={WHITE} />
          {#each [0, 1] as r (r)}
            {@const p = rows[r]}
            <div class="pen-row">
              <SevenSegment
                value={p ? pad(p.player, 2) : '88'}
                ghost={!p}
                height={100}
                color={RED}
                slanted={false}
              />
              <SevenSegment
                value={p ? pad(p.text, 4) : '8:88'}
                ghost={!p}
                height={100}
                color={AMBER}
                slanted={false}
              />
            </div>
          {/each}
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
    position: relative;
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    background: #000;
  }

  .dimmed {
    opacity: 0.3;
  }

  .top,
  .bottom {
    position: absolute;
    left: 30px;
    right: 30px;
    display: grid;
    grid-template-columns: 580px minmax(0, 1fr) 580px;
    gap: 20px;
  }

  .top {
    top: 26px;
    height: 590px;
  }

  .team,
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }

  .team {
    gap: 14px;
  }

  .center {
    justify-content: center;
    gap: 50px;
  }

  .name {
    display: flex;
    align-items: center;
    gap: 18px;
    height: 116px;
  }

  .logo {
    flex: none;
    width: 100px;
    height: 100px;
    object-fit: contain;
  }

  .tos {
    display: flex;
    gap: 18px;
    height: 28px;
  }

  /* Spie quadrate: spente appena visibili, accese a colore pieno. */
  .lamp {
    width: 56px;
    height: 28px;
    background: rgba(255, 176, 0, 0.1);
  }

  .lamp.on {
    background: #ffb000;
  }

  .lamp.big {
    width: 84px;
    height: 84px;
    background: rgba(255, 255, 255, 0.08);
  }

  .lamp.goal {
    background: #35ff6e;
  }

  .lamp.miss {
    background: #ff2a1f;
  }

  .strip {
    position: absolute;
    left: 0;
    right: 0;
    top: 624px;
    height: 76px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bottom {
    top: 708px;
    height: 350px;
  }

  .panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-evenly;
    min-width: 0;
    padding: 10px 0;
    border: 3px solid #262626;
  }

  .shots {
    display: flex;
    gap: 90px;
  }

  .pen-row {
    display: flex;
    align-items: center;
    gap: 60px;
  }

  .so {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 22px;
  }
</style>
