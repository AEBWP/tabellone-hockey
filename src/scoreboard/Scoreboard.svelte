<script lang="ts">
  import type { BoardStyle, GameView } from '../engine'
  import Arena from './arena/Scoreboard.svelte'
  import Classico from './classico/Scoreboard.svelte'

  /**
   * Tabellone spettatori nello stile scelto dalla console.
   * Ogni stile è disegnato su 1920×1080 pixel logici.
   */
  let {
    view,
    style = 'arena',
    animations = true,
  }: { view: GameView; style?: BoardStyle; animations?: boolean } = $props()
</script>

{#if style === 'classico'}
  <Classico {view} {animations} />
{:else}
  <Arena {view} {animations} />
{/if}
