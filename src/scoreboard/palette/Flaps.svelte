<script lang="ts">
  /**
   * Un testo fatto di tessere: ogni cifra (o lettera) su una tessera scura con
   * la piega a metà, come nei vecchi tabelloni a palette. Due punti e punto
   * restano fuori dalle tessere. Quando un carattere cambia, la sua tessera gira.
   */
  let {
    value,
    width,
    height,
    size,
    flip = true,
  }: {
    value: string
    /** Larghezza e altezza di ogni tessera e dimensione del carattere, in px. */
    width: number
    height: number
    size: number
    flip?: boolean
  } = $props()

  const chars = $derived([...value])
</script>

<span class="flaps" style:--w="{width}px" style:--h="{height}px" style:font-size="{size}px">
  {#each chars as ch, i (i)}
    {#if ch === ':' || ch === '.' || ch === ' '}
      <span class="sep">{ch}</span>
    {:else}
      {#key ch}
        <span class="flap" class:flip>{ch}</span>
      {/key}
    {/if}
  {/each}
</span>

<style>
  .flaps {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--w) * 0.07);
    line-height: 1;
  }

  .flap {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--w);
    height: var(--h);
    overflow: hidden;
    border-radius: calc(var(--w) * 0.07);
    color: #f4ecd6;
    background: linear-gradient(180deg, #3a3d43 0 50%, #2c2f34 50% 100%);
    box-shadow:
      inset 0 0 0 3px rgba(0, 0, 0, 0.55),
      0 8px 18px rgba(0, 0, 0, 0.55);
  }

  /* La piega orizzontale a metà tessera. */
  .flap::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: max(3px, calc(var(--h) * 0.014));
    translate: 0 -50%;
    background: #0c0d0f;
  }

  .flap.flip {
    animation: flip 260ms cubic-bezier(0.3, 0.7, 0.4, 1);
  }

  @keyframes flip {
    from {
      transform: perspective(600px) rotateX(-90deg);
    }
  }

  .sep {
    width: calc(var(--w) * 0.4);
    text-align: center;
    color: #f4ecd6;
  }

  @media (prefers-reduced-motion: reduce) {
    .flap.flip {
      animation: none;
    }
  }
</style>
