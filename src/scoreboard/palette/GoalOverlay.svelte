<script lang="ts">
  import { boardText } from '../../i18n/board'
  import type { GameView } from '../../engine'
  import { textColorOn } from '../../shared/color'
  import { fitFontSize } from '../../shared/labels'
  import { watchGoals } from '../goal-watch.svelte'

  /**
   * Gol in stile "Palette": le tessere girano una dopo l'altra e compongono
   * GOAL!, sotto il nome della squadra e il nuovo punteggio.
   */
  let { view }: { view: GameView } = $props()
  const text = $derived(boardText(view))

  const watch = watchGoals(() => view)
</script>

{#if watch.goal}
  {@const t = view.teams[watch.goal.team]}
  {@const name = t.name.toUpperCase()}
  {#key watch.goal.key}
    <div class="goal" style:--team={t.color} style:--on-team={textColorOn(t.color)}>
      <div class="word">
        {#each [...text.goalExclaimed] as ch, i (i)}
          <span class="flap" style:animation-delay="{i * 120}ms">{ch}</span>
        {/each}
      </div>
      <div class="team" style:font-size="{fitFontSize(name, 120, 1500)}px">
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
    gap: 44px;
    color: #f4ecd6;
    font-weight: 800;
    background: linear-gradient(180deg, #1d1f23, #141518);
    box-shadow: inset 0 0 0 18px #0b0c0d;
    animation: show 7s linear forwards;
  }

  .word {
    display: flex;
    gap: 22px;
  }

  .flap {
    position: relative;
    display: grid;
    place-items: center;
    width: 250px;
    height: 400px;
    overflow: hidden;
    border-radius: 18px;
    font-size: 360px;
    line-height: 1;
    background: linear-gradient(180deg, #3a3d43 0 50%, #2c2f34 50% 100%);
    box-shadow:
      inset 0 0 0 4px rgba(0, 0, 0, 0.55),
      0 12px 26px rgba(0, 0, 0, 0.6);
    animation: flip 420ms cubic-bezier(0.3, 0.7, 0.4, 1) both;
  }

  .flap::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 6px;
    translate: 0 -50%;
    background: #0c0d0f;
  }

  .team {
    display: flex;
    align-items: center;
    gap: 30px;
    max-width: 1700px;
    padding: 10px 50px;
    border-radius: 16px;
    line-height: 1.1;
    letter-spacing: 0.05em;
    white-space: nowrap;
    color: var(--on-team);
    background: var(--team);
    animation: rise 500ms 700ms ease-out both;
  }

  .team img {
    width: 1em;
    height: 1em;
    object-fit: contain;
  }

  .score {
    font-size: 150px;
    line-height: 1;
    animation: rise 500ms 900ms ease-out both;
  }

  @keyframes flip {
    from {
      transform: perspective(900px) rotateX(-90deg);
    }
  }

  @keyframes rise {
    from {
      translate: 0 50px;
      opacity: 0;
    }
  }

  @keyframes show {
    0%,
    100% {
      opacity: 0;
    }
    3%,
    92% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .flap,
    .team,
    .score {
      animation: none;
    }
  }
</style>
