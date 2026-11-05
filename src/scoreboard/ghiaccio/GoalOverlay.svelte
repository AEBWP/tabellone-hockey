<script lang="ts">
  import type { GameView } from '../../engine'
  import { textColorOn } from '../../shared/color'
  import { watchGoals } from '../goal-watch.svelte'

  /**
   * Gol in stile "Ghiaccio": un cerchio nel colore della squadra si allarga
   * dal centro, con anelli come onde sul ghiaccio.
   */
  let { view }: { view: GameView } = $props()

  const watch = watchGoals(() => view)
</script>

{#if watch.goal}
  {@const t = view.teams[watch.goal.team]}
  {@const scored = watch.goal.team}
  {#key watch.goal.key}
    <div class="goal" style:--team={t.color} style:--on-team={textColorOn(t.color)}>
      <div class="burst"></div>
      <div class="ring r1"></div>
      <div class="ring r2"></div>
      <div class="ring r3"></div>

      <div class="content">
        {#if t.logo}
          <div class="logo"><img src={t.logo} alt="" /></div>
        {/if}
        <div class="word">GOAL</div>
        <div class="name">{t.name}</div>
      </div>

      <div class="score-card">
        {#each ['home', 'away'] as const as id (id)}
          {@const st = view.teams[id]}
          <div class="s-team {id}" class:scored={id === scored} style:--st={st.color}>
            <span class="s-name">{st.shortName}</span>
            <span class="s-num">{st.score}</span>
          </div>
          {#if id === 'home'}<span class="s-sep"></span>{/if}
        {/each}
      </div>
    </div>
  {/key}
{/if}

<style>
  .goal {
    position: absolute;
    inset: 0;
    overflow: hidden;
    color: var(--on-team);
    font-family: 'Barlow Condensed', var(--font-ui);
    animation: life 7s ease-in-out forwards;
  }

  @keyframes life {
    0%,
    90% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* Il cerchio colorato che si allarga dal centro */
  .burst {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 50% 45%,
      color-mix(in srgb, var(--team) 80%, white) 0%,
      var(--team) 45%,
      color-mix(in srgb, var(--team) 70%, black) 100%
    );
    clip-path: circle(0% at 50% 45%);
    animation: burst 650ms cubic-bezier(0.3, 0.9, 0.3, 1) forwards;
  }

  @keyframes burst {
    to {
      clip-path: circle(80% at 50% 45%);
    }
  }

  .ring {
    position: absolute;
    left: 50%;
    top: 45%;
    width: 400px;
    height: 400px;
    margin: -200px 0 0 -200px;
    border: 10px solid rgba(255, 255, 255, 0.7);
    border-radius: 50%;
    opacity: 0;
    animation: ring 1.8s ease-out infinite;
  }

  .r2 {
    animation-delay: 0.6s;
  }

  .r3 {
    animation-delay: 1.2s;
  }

  @keyframes ring {
    0% {
      transform: scale(0.4);
      opacity: 0.8;
    }
    100% {
      transform: scale(4.5);
      opacity: 0;
    }
  }

  .content {
    position: absolute;
    left: 0;
    right: 0;
    top: 90px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .logo {
    display: grid;
    place-items: center;
    width: 280px;
    height: 280px;
    padding: 34px;
    border: 10px solid rgba(255, 255, 255, 0.85);
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    animation: pop 600ms 250ms cubic-bezier(0.18, 1.5, 0.4, 1) both;
  }

  .logo img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .word {
    font-size: 300px;
    font-weight: 800;
    line-height: 0.88;
    letter-spacing: 0.14em;
    padding-left: 0.14em;
    text-shadow: 0 14px 40px rgba(0, 0, 0, 0.25);
    animation: pop 600ms 400ms cubic-bezier(0.18, 1.4, 0.4, 1) both;
  }

  .name {
    font-size: 66px;
    font-weight: 700;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    opacity: 0.92;
    animation: rise 500ms 650ms ease-out both;
  }

  .score-card {
    position: absolute;
    left: 50%;
    bottom: 70px;
    display: flex;
    align-items: center;
    padding: 12px 20px;
    border-radius: 22px;
    background: #fff;
    color: #0d2240;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    transform: translateX(-50%);
    animation: card 500ms 900ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }

  @keyframes card {
    from {
      transform: translateX(-50%) translateY(140px);
      opacity: 0;
    }
  }

  .s-team {
    display: flex;
    align-items: center;
    gap: 26px;
    padding: 0 26px;
    font-weight: 800;
    line-height: 1;
  }

  .s-team.away {
    flex-direction: row-reverse;
  }

  .s-name {
    padding-left: 14px;
    border-left: 10px solid var(--st);
    font-size: 48px;
    letter-spacing: 0.08em;
  }

  .away .s-name {
    padding: 0 14px 0 0;
    border-left: 0;
    border-right: 10px solid var(--st);
  }

  .s-num {
    font-size: 110px;
  }

  .scored .s-num {
    color: var(--st);
    animation: pop 600ms 1.3s cubic-bezier(0.2, 1.6, 0.4, 1) both;
  }

  .s-sep {
    width: 3px;
    height: 90px;
    background: #d7e3ef;
  }

  @keyframes pop {
    from {
      transform: scale(0.4);
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      transform: translateY(40px);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .burst,
    .ring,
    .logo,
    .word,
    .name,
    .score-card,
    .s-num {
      animation: none !important;
    }

    .burst {
      clip-path: none;
    }
  }
</style>
