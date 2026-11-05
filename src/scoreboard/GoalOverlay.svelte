<script lang="ts">
  import type { GameView, TeamId } from '../engine'
  import { textColorOn } from '../shared/color'

  let { view }: { view: GameView } = $props()

  const DURATION_MS = 7_000

  let goal = $state<{ team: TeamId; key: number } | null>(null)
  // Non reattivi: servono solo per il confronto con il valore precedente.
  let previous: Record<TeamId, number> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let counter = 0

  $effect(() => {
    const current = { home: view.teams.home.goals, away: view.teams.away.goals }
    const before = previous
    previous = current
    // Al primo stato ricevuto (es. tabellone aperto a partita in corso) non si festeggia.
    if (!before) return

    for (const team of ['home', 'away'] as const) {
      if (current[team] > before[team]) {
        goal = { team, key: ++counter }
        clearTimeout(hideTimer)
        hideTimer = setTimeout(() => (goal = null), DURATION_MS)
      } else if (current[team] < before[team] && goal?.team === team) {
        // Gol annullato: via l'animazione.
        goal = null
      }
    }
  })

  $effect(() => () => clearTimeout(hideTimer))
</script>

{#if goal}
  {@const t = view.teams[goal.team]}
  {@const scored = goal.team}
  {#key goal.key}
    <div
      class="goal"
      class:with-logo={!!t.logo}
      style:--team={t.color}
      style:--on-team={textColorOn(t.color)}
    >
      <div class="dim"></div>

      <!-- Fascia diagonale nel colore della squadra che attraversa lo schermo -->
      <div class="band">
        <div class="band-fill"></div>
        <div class="band-edge top"></div>
        <div class="band-edge bottom"></div>
      </div>
      <div class="flash"></div>

      <div class="content">
        <div class="hero">
          {#if t.logo}
            <div class="logo"><img src={t.logo} alt="" /></div>
          {/if}
          <div class="word" data-text="GOAL!">GOAL!</div>
        </div>
        <div class="team-plate"><span>{t.name}</span></div>
      </div>

      <!-- Barra del punteggio in basso -->
      <div class="bug">
        {#each ['home', 'away'] as const as id (id)}
          {@const bt = view.teams[id]}
          <div
            class="bug-team {id}"
            class:scored={id === scored}
            style:--bt={bt.color}
            style:--on-bt={textColorOn(bt.color)}
          >
            <span class="bug-name">{bt.shortName}</span>
            <span class="bug-score">{bt.score}</span>
          </div>
          {#if id === 'home'}<span class="bug-sep"></span>{/if}
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
    animation: life 7s linear forwards;
  }

  /* Comparsa e uscita dell'intera animazione */
  @keyframes life {
    0% {
      opacity: 0;
    }
    2%,
    91% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  .dim {
    position: absolute;
    inset: 0;
    background: rgba(2, 4, 9, 0.78);
  }

  /* ── Fascia ───────────────────────────────────────────────────── */
  .band {
    position: absolute;
    left: -12%;
    right: -12%;
    top: 170px;
    height: 600px;
    transform: skewY(-4deg);
    animation: band-in 520ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }

  .band-fill {
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(100deg, rgba(255, 255, 255, 0.07) 0 36px, transparent 36px 120px),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--team) 80%, white) 0%,
        var(--team) 22%,
        color-mix(in srgb, var(--team) 70%, black) 100%
      );
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.6);
    animation: stripes 6s linear infinite;
  }

  .band-edge {
    position: absolute;
    left: 0;
    right: 0;
    height: 10px;
    background: #fff;
    opacity: 0.9;
    animation: edge-in 600ms 180ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }

  .band-edge.top {
    top: -22px;
    transform-origin: left;
  }

  .band-edge.bottom {
    bottom: -22px;
    transform-origin: right;
  }

  @keyframes band-in {
    from {
      transform: skewY(-4deg) translateX(-110%);
    }
  }

  @keyframes edge-in {
    from {
      transform: scaleX(0);
    }
  }

  @keyframes stripes {
    to {
      background-position:
        480px 0,
        0 0;
    }
  }

  /* Lampo bianco all'impatto */
  .flash {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 45%, rgba(255, 255, 255, 0.95), transparent 60%);
    opacity: 0;
    animation: flash 700ms 300ms ease-out both;
  }

  @keyframes flash {
    0% {
      opacity: 0;
    }
    18% {
      opacity: 0.9;
    }
    100% {
      opacity: 0;
    }
  }

  /* ── Contenuto centrale ────────────────────────────────────────── */
  .content {
    position: absolute;
    left: 0;
    right: 0;
    top: 170px;
    height: 600px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 26px;
  }

  .hero {
    display: flex;
    align-items: center;
    gap: 46px;
  }

  .logo {
    display: grid;
    place-items: center;
    width: 300px;
    height: 300px;
    animation: logo-in 700ms 280ms cubic-bezier(0.18, 1.5, 0.4, 1) both;
  }

  .logo img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.55));
  }

  @keyframes logo-in {
    from {
      transform: scale(0.3) rotate(-14deg);
      opacity: 0;
    }
  }

  .word {
    position: relative;
    font-size: 340px;
    font-weight: 800;
    font-style: italic;
    line-height: 0.85;
    letter-spacing: 0.02em;
    color: var(--on-team);
    transform: skewX(-8deg);
    text-shadow:
      0 8px 0 rgba(0, 0, 0, 0.25),
      0 24px 60px rgba(0, 0, 0, 0.45);
    animation:
      word-in 560ms 220ms cubic-bezier(0.2, 1.2, 0.3, 1) both,
      pulse 1.1s 900ms ease-in-out 4;
  }

  .goal:not(.with-logo) .word {
    font-size: 400px;
  }

  /* Riflesso di luce che attraversa la scritta */
  .word::after {
    content: attr(data-text);
    position: absolute;
    inset: 0;
    color: transparent;
    background: linear-gradient(
      100deg,
      transparent 35%,
      rgba(255, 255, 255, 0.85) 48%,
      transparent 60%
    );
    background-size: 260% 100%;
    background-clip: text;
    -webkit-background-clip: text;
    text-shadow: none;
    animation: shine 2.2s 700ms ease-in-out 3;
    background-position: 130% 0;
  }

  @keyframes word-in {
    from {
      transform: skewX(-8deg) translateX(-260px) scale(1.3);
      opacity: 0;
    }
  }

  @keyframes pulse {
    50% {
      transform: skewX(-8deg) scale(1.04);
    }
  }

  @keyframes shine {
    from {
      background-position: 130% 0;
    }
    to {
      background-position: -30% 0;
    }
  }

  .team-plate {
    padding: 14px 54px 10px;
    border-left: 12px solid var(--team);
    border-right: 12px solid var(--team);
    background: #05080f;
    font-size: 72px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #f4f7fb;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    clip-path: polygon(24px 0, 100% 0, calc(100% - 24px) 100%, 0 100%);
    animation: rise 500ms 650ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }

  @keyframes rise {
    from {
      transform: translateY(50px);
      opacity: 0;
    }
  }

  /* ── Barra del punteggio ───────────────────────────────────────── */
  .bug {
    position: absolute;
    left: 50%;
    bottom: 70px;
    display: flex;
    align-items: stretch;
    transform: translateX(-50%);
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-radius: 6px;
    background: #05080f;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    overflow: hidden;
    animation: bug-in 520ms 950ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }

  @keyframes bug-in {
    from {
      transform: translateX(-50%) translateY(160px);
      opacity: 0;
    }
  }

  .bug-team {
    display: flex;
    align-items: center;
    gap: 34px;
    padding: 12px 34px 8px;
    font-weight: 800;
    line-height: 1;
  }

  .bug-team.away {
    flex-direction: row-reverse;
  }

  .bug-name {
    padding: 8px 20px 4px;
    font-size: 54px;
    letter-spacing: 0.08em;
    color: var(--on-bt);
    background: var(--bt);
    border-radius: 3px;
  }

  .bug-score {
    min-width: 1ch;
    font-size: 110px;
    text-align: center;
    color: #f4f7fb;
  }

  .bug-team.scored .bug-score {
    color: #ffd166;
    animation: score-pop 600ms 1.4s cubic-bezier(0.2, 1.6, 0.4, 1) both;
  }

  @keyframes score-pop {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.35);
    }
    100% {
      transform: scale(1);
    }
  }

  .bug-sep {
    width: 2px;
    margin: 18px 0;
    background: rgba(255, 255, 255, 0.25);
  }

  @media (prefers-reduced-motion: reduce) {
    .band,
    .band-fill,
    .band-edge,
    .flash,
    .logo,
    .word,
    .word::after,
    .team-plate,
    .bug,
    .bug-score {
      animation: none !important;
    }
  }
</style>
