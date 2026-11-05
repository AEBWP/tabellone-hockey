<script lang="ts">
  import { cubicOut } from 'svelte/easing'
  import type { BoardStyle, GameView } from '../engine'
  import Arena from './arena/Scoreboard.svelte'
  import Broadcast from './broadcast/Scoreboard.svelte'
  import Classico from './classico/Scoreboard.svelte'
  import Ghiaccio from './ghiaccio/Scoreboard.svelte'
  import Retro from './retro/Scoreboard.svelte'
  import Matchup from './Matchup.svelte'

  /**
   * Tabellone spettatori nello stile scelto dalla console.
   * Prima dell'inizio mostra la presentazione “squadra A VS squadra B”;
   * all'avvio del tempo passa al tabellone completo con una transizione.
   * Ogni stile è disegnato su 1920×1080 pixel logici.
   */
  let {
    view,
    style = 'arena',
    animations = true,
  }: { view: GameView; style?: BoardStyle; animations?: boolean } = $props()

  /** Uscita della presentazione: le metà si allontanano, il VS si rimpicciolisce. */
  function matchupOut(node: HTMLElement) {
    return {
      duration: 900,
      easing: cubicOut,
      tick: (t: number) => node.style.setProperty('--p', String(t)),
    }
  }

  /** Entrata del tabellone, poco dopo l'inizio dell'uscita della presentazione. */
  function boardIn(_node: HTMLElement) {
    return {
      delay: 280,
      duration: 700,
      easing: cubicOut,
      css: (t: number) => `opacity: ${t}; transform: scale(${1.06 - 0.06 * t})`,
    }
  }
</script>

<div class="frame">
  {#if view.pregame}
    <div class="layer top" out:matchupOut>
      <Matchup {view} variant={style} />
    </div>
  {:else}
    <div class="layer" in:boardIn>
      {#if style === 'classico'}
        <Classico {view} {animations} />
      {:else if style === 'ghiaccio'}
        <Ghiaccio {view} {animations} />
      {:else if style === 'retro'}
        <Retro {view} {animations} />
      {:else if style === 'broadcast'}
        <Broadcast {view} {animations} />
      {:else}
        <Arena {view} {animations} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .frame {
    position: relative;
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    background: #000;
  }

  .layer {
    position: absolute;
    inset: 0;
  }

  /* Durante la transizione la presentazione resta sopra al tabellone che entra. */
  .layer.top {
    z-index: 1;
  }
</style>
