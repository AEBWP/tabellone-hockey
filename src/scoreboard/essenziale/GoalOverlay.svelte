<script lang="ts">
  import { boardText } from '../../i18n/board'
  import type { GameView } from '../../engine'
  import { textColorOn } from '../../shared/color'
  import { fitFontSize } from '../../shared/labels'
  import { watchGoals } from '../goal-watch.svelte'

  /**
   * Gol in stile "Essenziale": il colore della squadra entra da un lato e
   * copre lo schermo; sopra, GOAL, il nome della squadra e il punteggio.
   */
  let { view }: { view: GameView } = $props()
  const text = $derived(boardText(view))

  const watch = watchGoals(() => view)
</script>

{#if watch.goal}
  {@const t = view.teams[watch.goal.team]}
  {@const name = t.name.toUpperCase()}
  {#key watch.goal.key}
    <div
      class="goal"
      class:away={watch.goal.team === 'away'}
      style:--team={t.color}
      style:--on-team={textColorOn(t.color)}
    >
      <div class="word">{text.goal}</div>
      <div class="team" style:font-size="{fitFontSize(name, 130, 1700)}px">
        {#if t.logo}<img src={t.logo} alt="" />{/if}
        {name}
      </div>
      <div class="score">{view.teams.home.score} – {view.teams.away.score}</div>
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
    font-weight: 800;
    color: var(--on-team);
    background: var(--team);
    animation:
      wipe 500ms cubic-bezier(0.2, 0.8, 0.2, 1) both,
      out 500ms 6.5s ease-in forwards;
  }

  /* Gol degli ospiti: il colore entra da destra. */
  .goal.away {
    animation-name: wipe-right, out;
  }

  .word {
    font-size: 400px;
    line-height: 0.9;
    letter-spacing: 0.04em;
    animation: rise 500ms 300ms ease-out both;
  }

  .team {
    display: flex;
    align-items: center;
    gap: 30px;
    max-width: 1800px;
    line-height: 1.1;
    letter-spacing: 0.05em;
    white-space: nowrap;
    animation: rise 500ms 500ms ease-out both;
  }

  .team img {
    width: 1em;
    height: 1em;
    object-fit: contain;
  }

  .score {
    margin-top: 20px;
    padding: 0 50px;
    font-size: 160px;
    line-height: 1.05;
    color: #fff;
    background: #000;
    animation: rise 500ms 700ms ease-out both;
  }

  @keyframes wipe {
    from {
      clip-path: inset(0 100% 0 0);
    }
    to {
      clip-path: inset(0 0 0 0);
    }
  }

  @keyframes wipe-right {
    from {
      clip-path: inset(0 0 0 100%);
    }
    to {
      clip-path: inset(0 0 0 0);
    }
  }

  @keyframes out {
    to {
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      translate: 0 40px;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .goal,
    .goal.away,
    .word,
    .team,
    .score {
      animation: out 500ms 6.5s ease-in forwards;
    }
  }
</style>
