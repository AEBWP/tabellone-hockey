<script lang="ts">
  import type { GameView } from '../../engine'
  import { watchGoals } from '../goal-watch.svelte'
  import PixelLogo from './PixelLogo.svelte'
  import SevenSegment from './SevenSegment.svelte'

  /**
   * Gol in stile "Retrò": insegna luminosa con lampadine che corrono lungo
   * il bordo, GOAL lampeggiante e nome della squadra che scorre.
   */
  let { view }: { view: GameView } = $props()

  const watch = watchGoals(() => view)
</script>

{#if watch.goal}
  {@const t = view.teams[watch.goal.team]}
  {@const lamp = `color-mix(in srgb, ${t.color} 70%, white)`}
  {#key watch.goal.key}
    <div class="goal" style:--lamp={lamp}>
      <div class="chase"></div>

      <div class="word">GOAL!</div>

      <div class="marquee">
        <div class="track">
          {#each [0, 1, 2] as i (i)}
            <span class="item">
              {#if t.logo}<PixelLogo src={t.logo} size={110} pixels={20} />{/if}
              {t.name.toUpperCase()}
            </span>
          {/each}
        </div>
      </div>

      <div class="score">
        <span class="s-name">{view.teams.home.shortName}</span>
        <SevenSegment
          value={`${view.teams.home.score}-${view.teams.away.score}`}
          height={150}
          color="#ff3b2f"
        />
        <span class="s-name">{view.teams.away.shortName}</span>
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
    gap: 30px;
    overflow: hidden;
    font-family: 'Doto', monospace;
    font-weight: 900;
    background:
      radial-gradient(circle, rgba(255, 255, 255, 0.05) 2px, transparent 2.6px) 0 0 / 14px 14px,
      #030303;
    animation: life 7s steps(1, end) forwards;
  }

  @keyframes life {
    0% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* Bordo di lampadine che "corrono": due file sfalsate che si accendono a turno. */
  .chase {
    position: absolute;
    inset: 24px;
    padding: 30px;
    background: radial-gradient(circle, var(--lamp) 8px, transparent 9.5px) 0 0 / 30px 30px;
    /* Solo la cornice: il centro resta vuoto. */
    -webkit-mask:
      linear-gradient(#000 0 0) content-box exclude,
      linear-gradient(#000 0 0);
    mask:
      linear-gradient(#000 0 0) content-box exclude,
      linear-gradient(#000 0 0);
    filter: drop-shadow(0 0 8px var(--lamp));
    animation: chase 0.3s steps(1) infinite;
  }

  @keyframes chase {
    50% {
      background-position: 15px 15px;
    }
  }

  .word {
    font-size: 330px;
    line-height: 0.9;
    letter-spacing: 0.04em;
    color: var(--lamp);
    text-shadow:
      0 0 20px var(--lamp),
      0 0 60px var(--lamp);
    animation: flash 0.6s steps(2, end) 5;
  }

  @keyframes flash {
    to {
      visibility: hidden;
    }
  }

  .marquee {
    width: 1600px;
    overflow: hidden;
    border-top: 4px solid #2a2a2a;
    border-bottom: 4px solid #2a2a2a;
  }

  .track {
    display: flex;
    width: max-content;
    animation: scroll 6s linear infinite;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 30px;
    padding: 16px 80px;
    font-size: 100px;
    white-space: nowrap;
    color: #ffb000;
    text-shadow: 0 0 16px rgba(255, 176, 0, 0.7);
  }

  @keyframes scroll {
    from {
      transform: translateX(1600px);
    }
    to {
      transform: translateX(-100%);
    }
  }

  .score {
    display: flex;
    align-items: center;
    gap: 50px;
  }

  .s-name {
    font-size: 64px;
    color: #ffb000;
    text-shadow: 0 0 12px rgba(255, 176, 0, 0.6);
  }

  @media (prefers-reduced-motion: reduce) {
    .chase,
    .word,
    .track {
      animation: none;
    }
  }
</style>
