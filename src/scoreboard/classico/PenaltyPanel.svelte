<script lang="ts">
  import type { TeamView } from '../../engine'
  import type { BoardText } from '../../i18n/board'

  let { team, text }: { team: TeamView; text: BoardText } = $props()

  /** Righe visibili: penalità in corso (max 3); le altre compaiono come "in attesa". */
  const MAX_ROWS = 3
  const shown = $derived(team.penalties.filter((p) => !p.queued).slice(0, MAX_ROWS))
  const waiting = $derived(team.penalties.length - shown.length)
</script>

<div class="pen-panel" style:--team={team.color}>
  {#if team.penalties.length > 0}
    <div class="title">{text.penalties}</div>
    {#each shown as p (p.id)}
      <div class="row" class:misconduct={!p.countsForStrength}>
        <span class="player">#{p.player}</span>
        <span class="time">{p.text}</span>
      </div>
    {/each}
    {#if waiting > 0}
      <div class="waiting">{text.waiting(waiting)}</div>
    {/if}
  {/if}
</div>

<style>
  .pen-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .title {
    padding-left: 12px;
    border-left: 8px solid var(--team);
    font-size: 36px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #9cc3ea;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0 24px;
    border-radius: 14px;
    font-size: 76px;
    font-weight: 800;
    line-height: 1.12;
    background: rgba(255, 255, 255, 0.06);
  }

  .player {
    color: #ffd166;
  }

  .row.misconduct {
    font-size: 52px;
    opacity: 0.75;
  }

  .waiting {
    padding-left: 24px;
    font-size: 36px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #9cc3ea;
  }
</style>
