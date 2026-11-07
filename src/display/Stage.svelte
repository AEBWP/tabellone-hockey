<script lang="ts">
  import type { Snippet } from 'svelte'

  /**
   * Area di disegno a dimensione fissa (default 1920×1080, 16:9) scalata per
   * riempire la finestra mantenendo le proporzioni. Tutto il tabellone si
   * disegna in pixel "logici" e funziona su qualsiasi risoluzione.
   */
  let {
    width = 1920,
    height = 1080,
    children,
  }: { width?: number; height?: number; children: Snippet } = $props()

  let viewportWidth = $state(0)
  let viewportHeight = $state(0)

  const scale = $derived(Math.min(viewportWidth / width, viewportHeight / height) || 0)
</script>

<div class="viewport" bind:clientWidth={viewportWidth} bind:clientHeight={viewportHeight}>
  <div
    class="stage"
    style:width="{width}px"
    style:height="{height}px"
    style:transform="translate(-50%, -50%) scale({scale})"
  >
    {@render children()}
  </div>
</div>

<style>
  .viewport {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    /* Se lo schermo non è 16:9 le bande attorno non restano nere "da formato
       sbagliato": un fondo scuro come quello dei tabelloni, più chiaro al centro. */
    background: radial-gradient(ellipse at center, #0d1a2b 0%, #060c16 60%, #020509 100%), #03060b;
  }

  .stage {
    position: absolute;
    top: 50%;
    left: 50%;
    transform-origin: center;
    overflow: hidden;
  }
</style>
