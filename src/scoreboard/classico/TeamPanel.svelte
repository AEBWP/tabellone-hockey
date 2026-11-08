<script lang="ts">
  import type { TeamView } from '../../engine'
  import type { BoardText } from '../../i18n/board'
  import { textColorOn } from '../../shared/color'
  import { fitFontSize } from '../../shared/labels'

  let {
    team,
    text,
    dimmed = false,
  }: { team: TeamView; text: BoardText; dimmed?: boolean } = $props()
</script>

<div class="team" class:dimmed style:--team={team.color} style:--on-team={textColorOn(team.color)}>
  <div class="name-bar" class:with-logo={!!team.logo}>
    {#if team.logo}
      <img class="logo" src={team.logo} alt="" />
    {/if}
    <span
      class="short"
      style:font-size="{fitFontSize(team.shortName, 112, team.logo ? 360 : 480)}px"
      >{team.shortName}</span
    >
  </div>
  <div class="full-name">{team.name}</div>
  <div class="score">{team.score}</div>
  <div class="timeouts" title="Timeout disponibili">
    {#each { length: team.timeoutsLeft }, i (i)}
      <span class="to">{text.timeoutAbbr}</span>
    {/each}
  </div>
</div>

<style>
  .team {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    padding-top: 10px;
    transition: opacity 600ms;
  }

  .team.dimmed {
    opacity: 0.45;
  }

  .name-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    width: 100%;
    height: 130px;
    padding: 0 24px;
    border-radius: 18px;
    text-align: center;
    background: linear-gradient(180deg, var(--team), color-mix(in srgb, var(--team) 70%, black));
    color: var(--on-team);
    box-shadow: 0 0 50px color-mix(in srgb, var(--team) 45%, transparent);
  }

  .logo {
    flex: none;
    width: 110px;
    height: 110px;
    object-fit: contain;
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.45));
  }

  .short {
    min-width: 0;
    overflow: hidden;
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: 0.02em;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .full-name {
    max-width: 100%;
    margin-top: 10px;
    overflow: hidden;
    font-size: 48px;
    font-weight: 500;
    letter-spacing: 0.04em;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: #c8daef;
  }

  .score {
    font-size: 300px;
    font-weight: 800;
    line-height: 1;
    margin-top: 6px;
    text-shadow: 0 0 60px color-mix(in srgb, var(--team) 60%, transparent);
  }

  .timeouts {
    display: flex;
    gap: 12px;
    height: 54px;
  }

  .to {
    padding: 0 12px;
    border: 2px solid rgba(156, 195, 234, 0.6);
    border-radius: 8px;
    font-size: 42px;
    font-weight: 700;
    line-height: 50px;
    color: #9cc3ea;
  }
</style>
