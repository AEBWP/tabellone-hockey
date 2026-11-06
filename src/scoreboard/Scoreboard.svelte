<script lang="ts">
  import { untrack } from 'svelte'
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

  // Il tabellone resta sempre montato: durante la presentazione è già disegnato
  // (invisibile, sopra), così all'avvio non va disegnato da zero proprio mentre
  // parte la transizione. Entra solo se la partita inizia mentre lo si guarda;
  // aprendo il tabellone a partita in corso compare subito, come prima.
  let entering = $state(false)
  let wasPregame = untrack(() => view.pregame)
  $effect.pre(() => {
    const pregame = view.pregame
    if (wasPregame && !pregame) entering = true
    if (pregame) entering = false
    wasPregame = pregame
  })
</script>

<div class="frame">
  {#if view.pregame}
    <div class="layer top" out:matchupOut>
      <Matchup {view} variant={style} />
    </div>
  {/if}
  <div
    class="layer board"
    class:waiting={view.pregame}
    class:entering
    aria-hidden={view.pregame}
    onanimationend={(e) => e.target === e.currentTarget && (entering = false)}
  >
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

  /* Livello a sé: si disegna una volta e poi si mostra, si scala, si sfuma. */
  .board {
    will-change: opacity, transform;
  }

  /* Prima del via: già disegnato ma invisibile. Sta sopra alla presentazione
     perché un livello coperto non verrebbe disegnato in anticipo. */
  .board.waiting {
    z-index: 2;
    opacity: 0.002;
    /* Già alla scala da cui parte l'entrata: non va ridisegnato all'avvio. */
    transform: scale(1.06);
    pointer-events: none;
  }

  /* Entrata, poco dopo l'inizio dell'uscita della presentazione. */
  .board.entering {
    animation: board-in 700ms 280ms cubic-bezier(0.215, 0.61, 0.355, 1) both;
  }

  @keyframes board-in {
    from {
      opacity: 0;
      transform: scale(1.06);
    }
  }
</style>
