<script lang="ts">
  import type { BoardStyle, GameView, TeamView } from '../engine'
  import { boardText } from '../i18n/board'
  import { fitFontSize } from '../shared/labels'
  import PixelLogo from './retro/PixelLogo.svelte'

  /**
   * Presentazione prima della partita: “Squadra A VS Squadra B”.
   * L'uscita (all'avvio del tempo) è guidata dalla variabile CSS --p,
   * che la transizione porta da 1 (visibile) a 0 (uscita completata).
   */
  let { view, variant = 'arena' }: { view: GameView; variant?: BoardStyle } = $props()

  const text = $derived(boardText(view))
  const monogram = (t: TeamView) => t.shortName.slice(0, 3)
</script>

<div
  class="mu v-{variant}"
  style:--home={view.teams.home.color}
  style:--away={view.teams.away.color}
>
  {#each [['home', view.teams.home], ['away', view.teams.away]] as const as [side, team] (side)}
    <div class="half {side}">
      <div class="half-bg"></div>
      <div class="team">
        {#if team.logo}
          <div class="logo">
            {#if variant === 'retro'}
              <PixelLogo src={team.logo} size={300} pixels={24} />
            {:else}
              <img src={team.logo} alt="" />
            {/if}
          </div>
        {:else}
          <div class="monogram">{monogram(team)}</div>
        {/if}
        <div class="short" style:font-size="{fitFontSize(team.shortName, 140, 700)}px">
          {team.shortName}
        </div>
        <div class="name">{team.name}</div>
      </div>
    </div>
  {/each}

  <div class="divider"></div>
  <div class="vs"><span>{text.vs}</span></div>

  <div class="plate top">{text.gameStart}</div>
  <div class="plate bottom">{text.period(view)} · {view.clockText}</div>
</div>

<style>
  /* --p (1 → 0) arriva dalla transizione di uscita impostata dal contenitore. */
  .mu {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #020409;
    font-family: 'Barlow Condensed', var(--font-ui);
    color: #fff;
  }

  /* Gli elementi guidati da --p sono livelli a sé, già pronti: durante
     l'uscita si spostano e sfumano senza essere ridisegnati. */
  .half,
  .divider,
  .vs {
    will-change: transform;
  }

  .team,
  .plate {
    will-change: opacity;
  }

  /* ── Metà colorate con taglio diagonale ───────────────────────── */
  .half {
    position: absolute;
    inset: 0;
    animation: half-in 800ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }

  .half.home {
    --team: var(--home);
    clip-path: polygon(0 0, 55% 0, 45% 100%, 0 100%);
    transform: translateX(calc((1 - var(--p, 1)) * -60%));
  }

  .half.away {
    --team: var(--away);
    clip-path: polygon(55% 0, 100% 0, 100% 100%, 45% 100%);
    transform: translateX(calc((1 - var(--p, 1)) * 60%));
    animation-name: half-in-right;
  }

  @keyframes half-in {
    from {
      translate: -100% 0;
    }
  }

  @keyframes half-in-right {
    from {
      translate: 100% 0;
    }
  }

  .half-bg {
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(100deg, rgba(255, 255, 255, 0.05) 0 30px, transparent 30px 110px),
      radial-gradient(ellipse 60% 70% at var(--cx) 50%, transparent 0%, rgba(0, 0, 0, 0.55) 100%),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--team) 85%, white) 0%,
        var(--team) 35%,
        color-mix(in srgb, var(--team) 55%, black) 100%
      );
  }

  .home .half-bg {
    --cx: 25%;
  }

  .away .half-bg {
    --cx: 75%;
  }

  .team {
    position: absolute;
    top: 50%;
    width: 760px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transform: translate(-50%, -50%);
    opacity: var(--p, 1);
  }

  .home .team {
    left: 25%;
  }

  .away .team {
    left: 75%;
  }

  .logo {
    display: grid;
    place-items: center;
    width: 380px;
    height: 380px;
    animation: pop 700ms 350ms cubic-bezier(0.18, 1.5, 0.4, 1) both;
  }

  .logo img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.55));
  }

  .monogram {
    display: grid;
    place-items: center;
    width: 320px;
    height: 320px;
    margin: 30px 0;
    border: 10px solid rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.25);
    font-size: 130px;
    font-weight: 800;
    letter-spacing: 0.04em;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
    animation: pop 700ms 350ms cubic-bezier(0.18, 1.5, 0.4, 1) both;
  }

  .short {
    max-width: 100%;
    margin-top: 18px;
    overflow: hidden;
    font-size: 140px;
    font-weight: 800;
    line-height: 0.95;
    letter-spacing: 0.04em;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    animation: rise 600ms 500ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }

  .name {
    max-width: 100%;
    overflow: hidden;
    font-size: 46px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    white-space: nowrap;
    text-overflow: ellipsis;
    opacity: 0.9;
    text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    animation: rise 600ms 620ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }

  /* ── Linea diagonale e VS ─────────────────────────────────────── */
  .divider {
    position: absolute;
    top: -5%;
    bottom: -5%;
    left: 50%;
    width: 10px;
    background: #fff;
    box-shadow: 0 0 40px rgba(255, 255, 255, 0.7);
    transform: translateX(-50%) rotate(5.3deg) scaleY(var(--p, 1));
    animation: grow 600ms 300ms ease-out both;
  }

  @keyframes grow {
    from {
      scale: 1 0;
    }
  }

  .vs {
    position: absolute;
    left: 50%;
    top: 50%;
    display: grid;
    place-items: center;
    width: 250px;
    height: 250px;
    border: 8px solid #fff;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #1a2333, #05080f 70%);
    box-shadow:
      0 0 0 14px rgba(0, 0, 0, 0.35),
      0 20px 60px rgba(0, 0, 0, 0.6);
    transform: translate(-50%, -50%) scale(var(--p, 1));
    animation: vs-in 600ms 550ms cubic-bezier(0.18, 1.6, 0.4, 1) both;
  }

  .vs span {
    font-size: 140px;
    font-weight: 800;
    font-style: italic;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  /* Il corsivo sposta le lettere a destra e in basso: si ricentrano nel cerchio. */
  .v-arena .vs span {
    translate: -0.14em -0.04em;
  }

  /* In diritto basta alzarle un poco (il carattere ha più spazio sotto). */
  .v-classico .vs span,
  .v-ghiaccio .vs span {
    translate: 0 -0.04em;
  }

  @keyframes vs-in {
    from {
      scale: 0;
      rotate: -90deg;
    }
  }

  /* ── Targhe in alto e in basso ────────────────────────────────── */
  .plate {
    position: absolute;
    left: 50%;
    padding: 12px 54px 8px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    background: rgba(2, 4, 9, 0.85);
    font-size: 46px;
    font-weight: 700;
    letter-spacing: 0.24em;
    white-space: nowrap;
    transform: translateX(-50%);
    opacity: var(--p, 1);
    animation: fade 600ms 800ms ease-out both;
  }

  .plate.top {
    top: 56px;
  }

  .plate.bottom {
    bottom: 56px;
    font-size: 40px;
    letter-spacing: 0.16em;
    color: #c9d8ea;
  }

  @keyframes pop {
    from {
      scale: 0.4;
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      translate: 0 50px;
      opacity: 0;
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  /* ══ Variante Broadcast: piatta, metà dritte, fascia bianca centrale ══ */
  .v-broadcast {
    background: #0b0d12;
  }

  .v-broadcast .half.home {
    clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
  }

  .v-broadcast .half.away {
    clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%);
  }

  .v-broadcast .half-bg {
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.3) 0 14%, transparent 14%), var(--team);
  }

  .v-broadcast .logo,
  .v-broadcast .monogram {
    width: 340px;
    height: 340px;
    padding: 40px;
    border: 0;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
  }

  .v-broadcast .logo img {
    filter: none;
  }

  .v-broadcast .monogram {
    color: var(--team);
  }

  .v-broadcast .short,
  .v-broadcast .name {
    text-shadow: none;
  }

  .v-broadcast .divider {
    width: 230px;
    background: #f3f5f8;
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.45);
    transform: translateX(-50%) scaleY(var(--p, 1));
  }

  .v-broadcast .vs {
    width: 230px;
    height: auto;
    border: 0;
    border-radius: 0;
    background: none;
    box-shadow: none;
    color: #0b0d12;
  }

  .v-broadcast .vs span {
    font-size: 170px;
    font-style: normal;
  }

  .v-broadcast .plate {
    border: 0;
    background: #0b0d12;
    color: #fff;
  }

  .v-broadcast .plate.bottom {
    color: #9aa6b8;
  }

  /* ══ Variante Classico: morbida, bagliori e raggi di luce ══ */
  .v-classico .half-bg {
    background:
      repeating-conic-gradient(
        from 0deg at var(--cx) 45%,
        rgba(255, 255, 255, 0.07) 0deg 7deg,
        transparent 7deg 18deg
      ),
      radial-gradient(
        circle at var(--cx) 45%,
        color-mix(in srgb, var(--team) 75%, white) 0%,
        var(--team) 30%,
        color-mix(in srgb, var(--team) 35%, #050b16) 75%
      );
  }

  .v-classico .divider {
    width: 6px;
    background: rgba(255, 255, 255, 0.85);
    box-shadow: 0 0 60px 12px rgba(255, 255, 255, 0.45);
  }

  .v-classico .vs {
    border-width: 4px;
    border-color: rgba(156, 195, 234, 0.8);
    background: radial-gradient(circle, #12304f, #050d18 70%);
    box-shadow:
      0 0 60px rgba(120, 180, 255, 0.55),
      0 0 0 10px rgba(5, 13, 24, 0.5);
  }

  .v-classico .vs span {
    font-style: normal;
    text-shadow: 0 0 30px rgba(156, 195, 234, 0.8);
  }

  .v-classico .monogram {
    border-color: rgba(255, 255, 255, 0.85);
    box-shadow: 0 0 60px rgba(255, 255, 255, 0.35);
  }

  .v-classico .short {
    text-shadow: 0 0 50px rgba(255, 255, 255, 0.35);
  }

  .v-classico .plate {
    border: 3px solid rgba(156, 195, 234, 0.45);
    border-radius: 999px;
    background: rgba(5, 13, 24, 0.7);
  }

  /* ══ Variante Ghiaccio: chiara, testi blu notte ══ */
  .v-ghiaccio {
    background: #e3edf7;
    color: #0d2240;
  }

  .v-ghiaccio .half-bg {
    background:
      linear-gradient(0deg, var(--team) 0 18px, transparent 18px),
      radial-gradient(ellipse 70% 70% at var(--cx) 45%, #ffffff 0%, transparent 70%),
      color-mix(in srgb, var(--team) 22%, #f4f8fc);
  }

  .v-ghiaccio .logo,
  .v-ghiaccio .monogram {
    width: 330px;
    height: 330px;
    padding: 40px;
    border: 12px solid var(--team);
    border-radius: 50%;
    background: #fff;
    color: var(--team);
    box-shadow: 0 20px 50px rgba(13, 34, 64, 0.2);
  }

  .v-ghiaccio .logo img {
    filter: none;
  }

  .v-ghiaccio .short,
  .v-ghiaccio .name {
    text-shadow: none;
  }

  .v-ghiaccio .name {
    color: #5d7290;
    opacity: 1;
  }

  .v-ghiaccio .divider {
    width: 14px;
    background: #fff;
    box-shadow: 0 0 30px rgba(13, 34, 64, 0.2);
  }

  .v-ghiaccio .vs {
    border: 0;
    background: #0d2240;
    box-shadow: 0 20px 50px rgba(13, 34, 64, 0.35);
  }

  .v-ghiaccio .vs span {
    font-style: normal;
    color: #fff;
  }

  .v-ghiaccio .plate {
    border: 0;
    border-radius: 999px;
    color: #fff;
    background: #0d2240;
    box-shadow: 0 10px 24px rgba(13, 34, 64, 0.25);
  }

  .v-ghiaccio .plate.bottom {
    color: #0d2240;
    background: #fff;
  }

  /* ══ Variante Retrò: lampadine, scritte a puntini ══ */
  .v-retro {
    font-family: 'Doto', monospace;
    font-weight: 900;
    background:
      radial-gradient(circle, rgba(255, 255, 255, 0.05) 2px, transparent 2.6px) 0 0 / 14px 14px,
      #030303;
  }

  .v-retro .half-bg {
    background:
      radial-gradient(circle, rgba(255, 255, 255, 0.05) 2px, transparent 2.6px) 0 0 / 14px 14px,
      color-mix(in srgb, var(--team) 16%, #030303);
  }

  .v-retro .short,
  .v-retro .name {
    color: color-mix(in srgb, var(--team) 70%, white);
    text-shadow: 0 0 18px currentColor;
  }

  .v-retro .monogram {
    border: 8px dotted currentColor;
    background: none;
    box-shadow: none;
    color: color-mix(in srgb, var(--team) 70%, white);
  }

  .v-retro .logo img {
    filter: none;
  }

  .v-retro .divider {
    width: 8px;
    background: repeating-linear-gradient(180deg, #ffb000 0 14px, transparent 14px 28px);
    box-shadow: 0 0 18px rgba(255, 176, 0, 0.6);
  }

  .v-retro .vs {
    border: 6px dotted #ffb000;
    background: #030303;
    box-shadow: 0 0 40px rgba(255, 176, 0, 0.35);
  }

  .v-retro .vs span {
    font-style: normal;
    color: #ffb000;
    text-shadow: 0 0 20px rgba(255, 176, 0, 0.8);
    animation: retro-blink 1s steps(2, start) infinite;
  }

  @keyframes retro-blink {
    to {
      visibility: hidden;
    }
  }

  .v-retro .plate {
    border: 4px dotted #ffb000;
    background: #030303;
    color: #ffb000;
    text-shadow: 0 0 14px rgba(255, 176, 0, 0.7);
  }

  @media (prefers-reduced-motion: reduce) {
    .half,
    .logo,
    .monogram,
    .short,
    .name,
    .divider,
    .vs,
    .plate {
      animation: none;
    }
  }
</style>
