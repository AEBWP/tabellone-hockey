<script lang="ts">
  import type { BoardStyle, GameView } from '../engine'
  import { boardText } from '../i18n/board'
  import { fitFontSize } from '../shared/labels'
  import AlphaSegment from './led/AlphaSegment.svelte'
  import { fitSegmentHeight } from './led/segments'
  import SevenSegment from './retro/SevenSegment.svelte'

  /**
   * Regolamento "solo cronometro": un unico tempo a tutto schermo, valido per
   * tutti i campi. Niente squadre né punti. Disegnato su 1920×1080 nello stile scelto.
   */
  let { view, variant }: { view: GameView; variant: BoardStyle } = $props()

  const word = $derived(boardText(view).finalShort)
  const finished = $derived(view.phase === 'final')
  const segments = $derived(variant === 'led' || variant === 'retro')
  const led = $derived(variant === 'led')
  const color = $derived(
    finished || !view.clockRunning ? (led ? '#ffb000' : '#ff3b2f') : led ? '#35ff6e' : '#ffb000',
  )
</script>

<div class="clock-only v-{variant}">
  {#if finished}
    {#if segments}
      <AlphaSegment text={word} height={fitSegmentHeight(word, 420, 1720)} {color} />
    {:else}
      <div class="word" style:font-size="{fitFontSize(word, 520, 1700)}px">{word}</div>
    {/if}
  {:else if segments}
    <SevenSegment
      value={view.clockText.padStart(5, ' ')}
      height={720}
      {color}
      slanted={variant === 'retro'}
    />
  {:else}
    <div class="time" class:stopped={!view.clockRunning}>{view.clockText}</div>
  {/if}
</div>

<style>
  .clock-only {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    color: #fff;
    font-family: 'Barlow Condensed', var(--font-ui);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    background: #000;
  }

  .time,
  .word {
    line-height: 1;
    white-space: nowrap;
  }

  .time {
    font-size: 720px;
  }

  .time.stopped,
  .word {
    color: var(--stopped, #ffc845);
  }

  .v-arena {
    background: radial-gradient(ellipse at center, #0f2140, #050b16 75%);
  }

  .v-broadcast {
    background: #0b0d12;
  }

  .v-ghiaccio {
    --stopped: #c77a12;
    color: #0d2240;
    background: linear-gradient(180deg, #f2f7fc, #d5e2f0);
  }

  .v-classico {
    background: radial-gradient(ellipse at center, #17365a, #050d18 80%);
  }

  .v-palette {
    color: #f6efdc;
    background: #1a1c20;
  }

  .v-retro {
    background: #030303;
  }
</style>
