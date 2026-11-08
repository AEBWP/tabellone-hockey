<script lang="ts">
  import { DOTS, SEGMENT_NAMES, displayText, litSegments } from './segments'

  /**
   * Scritte a 14 segmenti: ogni lettera è disegnata segmento per segmento,
   * e i segmenti spenti restano appena visibili, come su un display vero.
   */
  let {
    text,
    height = 80,
    color = '#ffb000',
  }: { text: string; height?: number; color?: string } = $props()

  // Riquadro 64×100 per ogni carattere.
  const POINTS: Record<string, string> = {
    a: '12,4 52,4 57,9 52,15 12,15 7,9',
    d: '12,85 52,85 57,91 52,96 12,96 7,91',
    f: '8,12 13,17 13,44 8,49 3,44 3,17',
    e: '8,51 13,56 13,83 8,88 3,83 3,56',
    b: '56,12 61,17 61,44 56,49 51,44 51,17',
    c: '56,51 61,56 61,83 56,88 51,83 51,56',
    g: '12,45 27,45 30,50 27,55 12,55 9,50',
    p: '37,45 52,45 55,50 52,55 37,55 34,50',
    i: '28,18 36,18 36,41 32,45 28,41',
    l: '28,59 32,55 36,59 36,82 28,82',
    h: '16,18 21,18 28,36 28,44 23,44 16,26',
    j: '48,18 43,18 36,36 36,44 41,44 48,26',
    k: '16,82 21,82 28,64 28,56 23,56 16,74',
    m: '48,82 43,82 36,64 36,56 41,56 48,74',
  }

  const chars = $derived([...displayText(text)])
</script>

<span class="alpha" style:--c={color} style:height="{height}px" aria-label={text}>
  {#each chars as ch, i (i)}
    {#if ch === ' '}
      <svg viewBox="0 0 36 100" aria-hidden="true"></svg>
    {:else if DOTS[ch]}
      <svg viewBox="0 0 64 100" aria-hidden="true">
        {#each DOTS[ch] as [cx, cy], k (k)}
          <circle {cx} {cy} r="7" />
        {/each}
      </svg>
    {:else}
      {@const lit = litSegments(ch)}
      <svg viewBox="0 0 72 100" aria-hidden="true">
        {#each SEGMENT_NAMES as s (s)}
          <polygon points={POINTS[s]} class:on={lit.includes(s)} />
        {/each}
      </svg>
    {/if}
  {/each}
</span>

<style>
  .alpha {
    display: inline-flex;
    align-items: stretch;
    font-size: 0;
    white-space: nowrap;
  }

  svg {
    height: 100%;
    width: auto;
  }

  polygon {
    fill: var(--c);
    opacity: 0.08;
  }

  polygon.on,
  circle {
    fill: var(--c);
    opacity: 1;
  }
</style>
