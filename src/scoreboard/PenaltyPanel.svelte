<script lang="ts">
  import type { TeamView } from '../engine'

  let { team }: { team: TeamView } = $props()

  /** Righe sempre presenti (anche vuote): il tabellone non "salta" quando arriva una penalità. */
  const MIN_ROWS = 2
  const MAX_ROWS = 3
  const shown = $derived(team.penalties.filter((p) => !p.queued).slice(0, MAX_ROWS))
  const waiting = $derived(team.penalties.length - shown.length)
  const empty = $derived(Math.max(0, MIN_ROWS - shown.length))
</script>

<div class="pen" style:--team={team.color}>
  <div class="head">
    <span>PENALITÀ</span>
    {#if waiting > 0}<span class="waiting">+{waiting} IN ATTESA</span>{/if}
  </div>
  <div class="rows">
    {#each shown as p (p.id)}
      <div class="row" class:misconduct={!p.countsForStrength}>
        <span class="num">{p.player}</span>
        <span class="time">{p.text}</span>
      </div>
    {/each}
    {#each { length: empty }, i (i)}
      <div class="row empty">
        <span class="num"></span>
        <span class="time">—</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .pen {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border: 2px solid rgba(150, 180, 220, 0.22);
    border-radius: 6px;
    background: linear-gradient(180deg, #111a28 0%, #0a101a 100%);
    box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.07);
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 22px 8px;
    border-bottom: 2px solid rgba(150, 180, 220, 0.22);
    box-shadow: inset 6px 0 0 var(--team);
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 0.28em;
    color: #8fa9c8;
  }

  .waiting {
    font-size: 26px;
    letter-spacing: 0.08em;
    color: #ffb627;
  }

  .rows {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .row {
    display: grid;
    flex: 1;
    grid-template-columns: 150px 1fr;
    align-items: center;
    padding: 0 26px;
    font-weight: 800;
    line-height: 1;
  }

  .row + .row {
    border-top: 1px solid rgba(150, 180, 220, 0.12);
  }

  .num {
    font-size: 70px;
    color: #f4f7fb;
  }

  .num::before {
    content: '#';
    margin-right: 4px;
    font-size: 0.6em;
    color: #8fa9c8;
    vertical-align: 0.35em;
  }

  .time {
    font-size: 78px;
    text-align: right;
    color: #ffb627;
    text-shadow: 0 0 22px rgba(255, 182, 39, 0.35);
  }

  .row.misconduct .num,
  .row.misconduct .time {
    font-size: 54px;
    opacity: 0.75;
  }

  .row.empty .num,
  .row.empty .time {
    color: rgba(143, 169, 200, 0.18);
    text-shadow: none;
  }

  .row.empty .num::before {
    content: '';
  }
</style>
