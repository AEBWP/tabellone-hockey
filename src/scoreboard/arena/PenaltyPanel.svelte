<script lang="ts">
  import type { TeamView } from '../../engine'
  import type { BoardText } from '../../i18n/board'

  let { team, text }: { team: TeamView; text: BoardText } = $props()

  /** Righe sempre presenti (anche vuote): il tabellone non "salta" quando arriva una penalità. */
  const MIN_ROWS = 2
  const MAX_ROWS = 3
  const shown = $derived(team.penalties.filter((p) => !p.queued).slice(0, MAX_ROWS))
  const waiting = $derived(team.penalties.length - shown.length)
  const empty = $derived(Math.max(0, MIN_ROWS - shown.length))
</script>

<div class="pen" style:--team={team.color}>
  <div class="head">
    <span>{text.penalties}</span>
    {#if waiting > 0}<span class="waiting">{text.waiting(waiting)}</span>{/if}
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
    font-size: 42px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: #8fa9c8;
  }

  .waiting {
    font-size: 36px;
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
    font-size: 76px;
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
    font-size: 86px;
    text-align: right;
    color: #ffb627;
    text-shadow: 0 0 22px rgba(255, 182, 39, 0.35);
  }

  .row.misconduct .num,
  .row.misconduct .time {
    font-size: 60px;
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
