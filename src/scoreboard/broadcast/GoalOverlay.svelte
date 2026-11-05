<script lang="ts">
  import type { GameView } from '../../engine'
  import { textColorOn } from '../../shared/color'
  import { watchGoals } from '../goal-watch.svelte'

  /** Gol in stile "Broadcast": due ante nel colore della squadra si chiudono sul tabellone. */
  let { view }: { view: GameView } = $props()

  const watch = watchGoals(() => view)
</script>

{#if watch.goal}
  {@const t = view.teams[watch.goal.team]}
  {@const scored = watch.goal.team}
  {#key watch.goal.key}
    <div class="goal" style:--team={t.color} style:--on-team={textColorOn(t.color)}>
      <div class="door top"></div>
      <div class="door bottom"></div>
      <div class="seam"></div>

      <div class="content">
        {#if t.logo}
          <div class="logo"><img src={t.logo} alt="" /></div>
        {/if}
        <div class="word">GOAL</div>
        <div class="name">{t.name}</div>
        <div class="score">
          {#each ['home', 'away'] as const as id (id)}
            {@const st = view.teams[id]}
            <span class="s-team" class:scored={id === scored}>
              <span class="s-name">{st.shortName}</span>
              <span class="s-num">{st.score}</span>
            </span>
            {#if id === 'home'}<span class="s-dash">–</span>{/if}
          {/each}
        </div>
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
  }

  /* Le due ante: si chiudono in 0,45 s e si riaprono alla fine (7 s in tutto). */
  .door {
    position: absolute;
    left: 0;
    right: 0;
    height: 50.5%;
    background: var(--team);
  }

  .door.top {
    top: 0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 60%), var(--team);
    animation: door-top 7s cubic-bezier(0.7, 0, 0.2, 1) both;
  }

  .door.bottom {
    bottom: 0;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.28), transparent 70%), var(--team);
    animation: door-bottom 7s cubic-bezier(0.7, 0, 0.2, 1) both;
  }

  @keyframes door-top {
    0% {
      transform: translateY(-100%);
    }
    6.5%,
    92% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(-100%);
    }
  }

  @keyframes door-bottom {
    0% {
      transform: translateY(100%);
    }
    6.5%,
    92% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(100%);
    }
  }

  .seam {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(50% - 4px);
    height: 8px;
    background: #fff;
    animation: seam 7s ease-out both;
  }

  /* La linea di chiusura compare quando le ante si toccano e sparisce prima della scritta. */
  @keyframes seam {
    0%,
    6% {
      transform: scaleX(0);
      opacity: 1;
    }
    9% {
      transform: scaleX(1);
      opacity: 1;
    }
    13%,
    100% {
      transform: scaleX(1);
      opacity: 0;
    }
  }

  /* ── Contenuto ────────────────────────────────────────────────── */
  .content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    animation: content 7s linear both;
  }

  @keyframes content {
    0%,
    7% {
      opacity: 0;
    }
    10%,
    88% {
      opacity: 1;
    }
    91%,
    100% {
      opacity: 0;
    }
  }

  .logo {
    display: grid;
    place-items: center;
    width: 250px;
    height: 250px;
    padding: 28px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
    animation: drop 500ms 450ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }

  .logo img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .word {
    font-size: 330px;
    font-weight: 800;
    line-height: 0.82;
    letter-spacing: 0.12em;
    padding-left: 0.12em;
    animation: word 600ms 520ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }

  .name {
    padding: 8px 40px 4px;
    font-size: 64px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--team);
    background: var(--on-team);
    animation: drop 500ms 700ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }

  .score {
    display: flex;
    align-items: center;
    gap: 26px;
    margin-top: 18px;
    padding: 8px 30px;
    background: #0b0d12;
    color: #fff;
    animation: drop 500ms 850ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }

  .s-team {
    display: flex;
    align-items: center;
    gap: 22px;
    font-weight: 800;
    line-height: 1;
  }

  .s-team:last-child {
    flex-direction: row-reverse;
  }

  .s-name {
    font-size: 46px;
    letter-spacing: 0.1em;
    color: #9aa6b8;
  }

  .s-num {
    font-size: 96px;
  }

  .s-team.scored .s-num {
    padding: 0 16px;
    color: #0b0d12;
    background: #fff;
    animation: flip 600ms 1.3s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }

  .s-dash {
    font-size: 70px;
    color: #9aa6b8;
  }

  @keyframes word {
    from {
      transform: scaleY(0);
      opacity: 0;
    }
  }

  @keyframes drop {
    from {
      transform: translateY(-30px);
      opacity: 0;
    }
  }

  @keyframes flip {
    0% {
      transform: rotateX(90deg);
    }
    100% {
      transform: rotateX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .door,
    .seam,
    .logo,
    .word,
    .name,
    .score,
    .s-num {
      animation: none !important;
    }
  }
</style>
