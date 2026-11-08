<script lang="ts">
  import type { TeamView } from '../../engine'
  import { textColorOn } from '../../shared/color'
  import type { BoardText } from '../../i18n/board'
  import { fitFontSize } from '../../shared/labels'

  let {
    team,
    side,
    text,
    dimmed = false,
  }: { team: TeamView; side: 'home' | 'away'; text: BoardText; dimmed?: boolean } = $props()

  /** Timeout: almeno una spia (spenta se non ne restano). */
  const timeoutPills = $derived(Math.max(1, team.timeoutsLeft))
</script>

<div
  class="team {side}"
  class:dimmed
  style:--team={team.color}
  style:--on-team={textColorOn(team.color)}
>
  <div class="plate">
    {#if team.logo}
      <div class="logo"><img src={team.logo} alt="" /></div>
    {/if}
    <div class="names">
      <span
        class="short"
        style:font-size="{fitFontSize(team.shortName, 116, team.logo ? 350 : 500)}px"
        >{team.shortName}</span
      >
      <span class="full">{team.name}</span>
    </div>
  </div>

  <div class="score-box">
    <span class="score">{team.score}</span>
  </div>

  <div class="timeouts">
    <span class="to-label">{text.timeout}</span>
    {#each { length: timeoutPills }, i (i)}
      <span class="pill" class:on={i < team.timeoutsLeft}></span>
    {/each}
  </div>
</div>

<style>
  .team {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-width: 0;
    transition: opacity 600ms;
  }

  .team.dimmed {
    opacity: 0.4;
  }

  /* Targa della squadra: colore pieno, angolo smussato verso il centro. */
  .plate {
    position: relative;
    display: flex;
    align-items: center;
    gap: 22px;
    height: 168px;
    padding: 0 40px 0 26px;
    overflow: hidden;
    color: var(--on-team);
    background:
      linear-gradient(
        115deg,
        rgba(255, 255, 255, 0.22) 0%,
        rgba(255, 255, 255, 0.04) 38%,
        transparent 38.2%,
        rgba(0, 0, 0, 0.18) 100%
      ),
      var(--team);
    clip-path: polygon(0 0, 100% 0, calc(100% - 34px) 100%, 0 100%);
    box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.25);
  }

  .away .plate {
    flex-direction: row-reverse;
    padding: 0 26px 0 40px;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 34px 100%);
  }

  .logo {
    display: grid;
    flex: none;
    place-items: center;
    width: 128px;
    height: 128px;
  }

  .logo img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.45));
  }

  .names {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .away .names {
    align-items: flex-end;
    text-align: right;
  }

  .short {
    overflow: hidden;
    font-size: 116px;
    font-weight: 800;
    line-height: 0.95;
    letter-spacing: 0.04em;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .full {
    overflow: hidden;
    font-size: 40px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    text-overflow: ellipsis;
    opacity: 0.85;
  }

  /* Riquadro del punteggio: display scuro con riga del colore della squadra. */
  .score-box {
    position: relative;
    display: grid;
    flex: 1;
    place-items: center;
    border: 2px solid rgba(150, 180, 220, 0.22);
    border-radius: 6px;
    background:
      repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.015) 0 1px, transparent 1px 4px),
      linear-gradient(180deg, #060a11, #0a111c);
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.07),
      inset 0 0 70px rgba(0, 0, 0, 0.85),
      0 20px 50px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .score-box::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 10px;
    background: var(--team);
    box-shadow: 0 0 30px var(--team);
  }

  .score {
    font-size: 300px;
    font-weight: 800;
    line-height: 1;
    color: #f4f7fb;
    text-shadow:
      0 0 30px rgba(220, 235, 255, 0.3),
      0 0 80px color-mix(in srgb, var(--team) 35%, transparent);
  }

  .timeouts {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 44px;
  }

  .away .timeouts {
    flex-direction: row-reverse;
  }

  .to-label {
    font-size: 38px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #8fa9c8;
  }

  .pill {
    width: 46px;
    height: 14px;
    border: 2px solid rgba(150, 180, 220, 0.35);
    border-radius: 3px;
  }

  .pill.on {
    border-color: var(--team);
    background: var(--team);
    box-shadow: 0 0 12px var(--team);
  }
</style>
