<script lang="ts">
  import { boardText } from '../../i18n/board'
  import type { GameView } from '../../engine'
  import { watchGoals } from '../goal-watch.svelte'
  import { textColorOn } from '../../shared/color'

  let { view }: { view: GameView } = $props()
  const text = $derived(boardText(view))

  const DURATION_MS = 7_000

  // Per squadra vera: scambiare i lati non fa partire l'animazione.
  const watch = watchGoals(() => view, DURATION_MS)
  const goal = $derived(watch.goal)
</script>

{#if goal}
  {@const t = view.teams[goal.team]}
  {#key goal.key}
    <div
      class="overlay"
      class:with-logo={!!t.logo}
      style:--team={t.color}
      style:--on-team={textColorOn(t.color)}
    >
      <div class="rays"></div>
      {#if t.logo}
        <img class="logo" src={t.logo} alt="" />
      {/if}
      <div class="word">{text.goalExclaimed}</div>
      <div class="team">{t.name.toUpperCase()}</div>
      <div class="score">{view.teams.home.score} – {view.teams.away.score}</div>
    </div>
  {/key}
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: var(--on-team);
    background: radial-gradient(
      ellipse at center,
      color-mix(in srgb, var(--team) 80%, white) 0%,
      var(--team) 45%,
      color-mix(in srgb, var(--team) 55%, black) 100%
    );
    animation: overlay 7s ease-in-out forwards;
  }

  .rays {
    position: absolute;
    inset: -50%;
    background: repeating-conic-gradient(
      from 0deg,
      rgba(255, 255, 255, 0.12) 0deg 8deg,
      transparent 8deg 20deg
    );
    animation: spin 14s linear infinite;
  }

  .logo {
    position: relative;
    width: 260px;
    height: 260px;
    object-fit: contain;
    filter: drop-shadow(0 12px 30px rgba(0, 0, 0, 0.5));
    animation: logo-in 800ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }

  /* Con il logo la scritta si rimpicciolisce per far stare tutto. */
  .with-logo .word {
    font-size: 320px;
  }

  .word {
    position: relative;
    font-size: 420px;
    font-weight: 800;
    line-height: 0.9;
    letter-spacing: 0.04em;
    text-shadow: 0 16px 60px rgba(0, 0, 0, 0.45);
    animation:
      slam 700ms cubic-bezier(0.2, 1.6, 0.4, 1) both,
      pulse 900ms 700ms ease-in-out 5;
  }

  .team {
    position: relative;
    margin-top: 10px;
    font-size: 110px;
    font-weight: 800;
    letter-spacing: 0.06em;
    animation: rise 600ms 400ms ease-out both;
  }

  .score {
    position: relative;
    margin-top: 10px;
    padding: 0 48px;
    border-radius: 24px;
    font-size: 130px;
    font-weight: 800;
    color: #fff;
    background: rgba(0, 0, 0, 0.3);
    animation: rise 600ms 700ms ease-out both;
  }

  @keyframes overlay {
    0% {
      opacity: 0;
    }
    4%,
    90% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @keyframes slam {
    from {
      transform: scale(3);
      opacity: 0;
    }
  }

  @keyframes pulse {
    50% {
      transform: scale(1.06);
    }
  }

  @keyframes rise {
    from {
      transform: translateY(60px);
      opacity: 0;
    }
  }

  @keyframes logo-in {
    from {
      transform: scale(0.3) rotate(-20deg);
      opacity: 0;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rays,
    .logo,
    .word,
    .team,
    .score {
      animation: none;
    }
  }
</style>
