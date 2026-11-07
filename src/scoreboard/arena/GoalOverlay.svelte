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
          <div class="word">
            {text.goalExclaimed}<span class="shine" aria-hidden="true"
              ><span>{text.goalExclaimed}</span></span
            >
          </div>
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
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--team) 80%, white) 0%,
      var(--team) 22%,
      color-mix(in srgb, var(--team) 70%, black) 100%
    );
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }

  /* Strisce che scorrono: livello a parte spostato con transform, così a ogni
     fotogramma non si ridisegna la fascia (con l'ombra) ma si sposta solo. */
  .band-fill::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -480px;
    right: 0;
    background: repeating-linear-gradient(
      100deg,
      rgba(255, 255, 255, 0.07) 0 36px,
      transparent 36px 120px
    );
    will-change: transform;
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
      transform: translateX(480px);
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
    /* Livello a sé: logo e ombra si disegnano una volta sola, poi si muovono. */
    will-change: transform;
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
    /* Livello a sé: la scritta con le ombre non si ridisegna a ogni pulsazione. */
    will-change: transform;
  }

  .goal:not(.with-logo) .word {
    font-size: 400px;
  }

  /* Riflesso di luce che attraversa la scritta.
     Una finestra larga 2,6 volte la scritta, sfumata con una maschera, scorre
     sopra a una copia bianca del testo che si sposta al contrario e resta
     ferma: solo transform, nessun ridisegno del testo a ogni fotogramma. */
  .shine {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 260%;
    pointer-events: none;
    -webkit-mask-image: linear-gradient(100deg, transparent 35%, #000 48%, transparent 60%);
    mask-image: linear-gradient(100deg, transparent 35%, #000 48%, transparent 60%);
    transform: translateX(-80%);
    animation: shine 2.2s 700ms ease-in-out 3;
  }

  .shine > span {
    position: absolute;
    top: 0;
    left: 0;
    width: calc(100% / 2.6);
    height: 100%;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: none;
    transform: translateX(208%);
    animation: shine-text 2.2s 700ms ease-in-out 3;
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

  /* Equivale a un gradiente largo 260% che va da background-position 130% a -30%. */
  @keyframes shine {
    from {
      transform: translateX(-80%);
    }
    to {
      transform: translateX(18.4615%);
    }
  }

  @keyframes shine-text {
    from {
      transform: translateX(208%);
    }
    to {
      transform: translateX(-48%);
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
    .band-fill::before,
    .band-edge,
    .flash,
    .logo,
    .word,
    .shine,
    .shine > span,
    .team-plate,
    .bug,
    .bug-score {
      animation: none !important;
    }
  }
</style>
