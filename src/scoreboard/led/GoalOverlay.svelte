<script lang="ts">
  import { boardText } from '../../i18n/board'
  import type { GameView } from '../../engine'
  import { watchGoals } from '../goal-watch.svelte'
  import SevenSegment from '../retro/SevenSegment.svelte'
  import AlphaSegment from './AlphaSegment.svelte'
  import { fitSegmentHeight } from './segments'

  /** Gol in stile "LED": la scritta lampeggia a tutto schermo, senza effetti sfocati. */
  let { view }: { view: GameView } = $props()
  const text = $derived(boardText(view))

  const watch = watchGoals(() => view)
</script>

{#if watch.goal}
  {@const t = view.teams[watch.goal.team]}
  {@const lamp = `color-mix(in srgb, ${t.color} 55%, white)`}
  {#key watch.goal.key}
    <div class="goal">
      <div class="word">
        <AlphaSegment
          text={text.goalExclaimed}
          height={fitSegmentHeight(text.goalExclaimed, 360, 1720)}
          color={lamp}
        />
      </div>
      <AlphaSegment text={t.name} height={fitSegmentHeight(t.name, 130, 1720)} color="#ffb000" />
      <div class="score">
        <AlphaSegment text={view.teams.home.shortName} height={84} color="#f2f6ff" />
        <SevenSegment
          value={`${view.teams.home.score}-${view.teams.away.score}`}
          height={190}
          color="#ff2a1f"
          slanted={false}
        />
        <AlphaSegment text={view.teams.away.shortName} height={84} color="#f2f6ff" />
      </div>
    </div>
  {/key}
{/if}

<style>
  .goal {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 56px;
    overflow: hidden;
    background: #000;
  }

  .word {
    animation: flash 0.6s steps(2, end) 5;
  }

  @keyframes flash {
    to {
      visibility: hidden;
    }
  }

  .score {
    display: flex;
    align-items: center;
    gap: 60px;
  }

  @media (prefers-reduced-motion: reduce) {
    .word {
      animation: none;
    }
  }
</style>
