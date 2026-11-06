<script lang="ts">
  import type { GameState } from '../engine'
  import { describeEvent } from './format'
  import HelpTip from './HelpTip.svelte'
  import { t } from '../i18n/ui.svelte'

  let {
    game,
    undoLabel,
    onundo,
  }: { game: GameState; undoLabel: string | null; onundo: () => void } = $props()

  const lines = $derived(
    [...game.events].reverse().map((e) => ({
      id: e.id,
      type: e.type,
      color: game.teams[e.team].color,
      ...describeEvent(e, game.teams, game.rules),
    })),
  )
</script>

<section class="panel log">
  <h2 class="panel-title">
    {t('Cronaca')}
    <HelpTip title={t('Cronaca e annulla')}>
      {@html t(
        'Qui compaiono gol e penalità con il momento in cui sono avvenuti. Se hai sbagliato, usa <b>Annulla</b> (o <kbd>Ctrl</kbd> + <kbd>Z</kbd>): annulla l’ultima azione di gioco senza toccare il cronometro. Si può annullare solo all’interno del periodo in corso.',
      )}
    </HelpTip>
  </h2>

  <button type="button" class="btn undo" disabled={!undoLabel} onclick={onundo}>
    ↶ {undoLabel ? t('Annulla: {label}', { label: undoLabel }) : t('Niente da annullare')}
    {#if undoLabel}<kbd>Ctrl</kbd><kbd>Z</kbd>{/if}
  </button>

  <ol>
    {#each lines as line (line.id)}
      <li style:--team={line.color}>
        <span class="when">{line.when}</span>
        <span class="icon">{line.type === 'goal' ? '🥅' : '⏱'}</span>
        <span class="text">{line.text}</span>
      </li>
    {:else}
      <li class="empty muted">{t('Ancora nessun evento.')}</li>
    {/each}
  </ol>
</section>

<style>
  .log {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .undo {
    justify-content: flex-start;
    width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  ol {
    flex: 1;
    min-height: 0;
    margin: 0.75rem 0 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 6.5rem auto 1fr;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    border-left: 4px solid var(--team);
    border-radius: 4px;
    font-size: 0.92rem;
  }

  li + li {
    margin-top: 0.25rem;
  }

  li:nth-child(odd) {
    background: rgba(255, 255, 255, 0.03);
  }

  li.empty {
    display: block;
    border: 0;
  }

  .when {
    font-variant-numeric: tabular-nums;
    color: var(--ice-300);
  }
</style>
