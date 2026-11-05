<script lang="ts">
  /**
   * Logo "pixelato", come su un vecchio tabellone a lampadine: l'immagine
   * viene ridotta a pochi pixel e poi ingrandita senza sfumature.
   */
  let { src, size = 120, pixels = 24 }: { src: string; size?: number; pixels?: number } = $props()

  let canvas = $state<HTMLCanvasElement>()

  $effect(() => {
    const target = canvas
    if (!target) return
    const img = new Image()
    img.onload = () => {
      const ctx = target.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, pixels, pixels)
      const scale = Math.min(pixels / img.naturalWidth, pixels / img.naturalHeight)
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      ctx.drawImage(img, (pixels - w) / 2, (pixels - h) / 2, w, h)
    }
    img.src = src
  })
</script>

<canvas
  bind:this={canvas}
  width={pixels}
  height={pixels}
  style:width="{size}px"
  style:height="{size}px"
  aria-hidden="true"
></canvas>

<style>
  canvas {
    image-rendering: pixelated;
    filter: drop-shadow(0 0 10px rgba(255, 190, 80, 0.35));
  }
</style>
