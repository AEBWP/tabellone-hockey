<script lang="ts">
  import { onDestroy } from 'svelte'
  import { deriveView, type GameState } from '../engine'
  import Scoreboard from '../scoreboard/Scoreboard.svelte'
  import Stage from '../display/Stage.svelte'
  import { now } from '../shared/time'
  import { t } from '../i18n/ui.svelte'

  /**
   * Il tabellone in piccolo, nella console: si vede subito che cosa c'è sul
   * maxischermo e che il tempo scorre. Si aggiorna 4 volte al secondo e senza
   * animazioni, per non appesantire la console sui PC meno potenti.
   * Con il tabellone chiuso non si disegna nessun tabellone (nemmeno sbiadito,
   * per non far pensare che sia acceso): solo uno schermo spento barrato.
   */
  let { game, connected }: { game: GameState; connected: boolean } = $props()

  let clock = $state(now())
  const timer = setInterval(() => (clock = now()), 250)
  onDestroy(() => clearInterval(timer))

  const view = $derived(deriveView(game, clock))
</script>

{#if connected}
  <div class="board-preview" title={t('Anteprima del tabellone')}>
    <Stage>
      <Scoreboard {view} style={game.boardStyle} animations={false} />
    </Stage>
  </div>
{:else}
  <div class="board-preview off" title={t('Tabellone non aperto')}>
    <!-- Schermo spento, barrato. -->
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="12.5" rx="1.5" />
      <path d="M8.5 20h7M12 16.5V20" />
      <path class="slash" d="M3 3l18 18" />
    </svg>
    <span class="label">{t('Tabellone non aperto')}</span>
  </div>
{/if}

<style>
  .board-preview {
    position: relative;
    width: 112px;
    aspect-ratio: 16 / 9;
    border: 1px solid var(--ice-800);
    border-radius: 6px;
    overflow: hidden;
    background: #000;
    pointer-events: none;
  }

  .board-preview.off {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: 2px dashed var(--warn);
    color: var(--warn);
    background:
      repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0 6px, transparent 6px 12px),
      var(--ice-950);
  }

  svg {
    width: 28px;
    height: 28px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .slash {
    stroke-width: 2.4;
  }

  .label {
    padding: 0 4px;
    font-size: 0.6rem;
    font-weight: 700;
    line-height: 1.1;
    text-align: center;
  }
</style>
