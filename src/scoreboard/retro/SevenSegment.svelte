<script lang="ts">
  /**
   * Cifre a 7 segmenti come nei vecchi tabelloni: ogni cifra è disegnata
   * segmento per segmento, e i segmenti spenti restano appena visibili.
   * Caratteri gestiti: 0-9, "-", ":", "." e lo spazio (cifra spenta).
   */
  let {
    value,
    height = 200,
    color = '#ff3b2f',
    /** Tutto spento (es. riga di penalità vuota): si vedono solo i segmenti in ombra. */
    ghost = false,
  }: { value: string; height?: number; color?: string; ghost?: boolean } = $props()

  // Segmenti a-g in un riquadro 60×100 (a in alto, poi in senso orario, g al centro).
  const SEGMENTS: Record<string, string> = {
    a: '13,4 47,4 53,10 47,16 13,16 7,10',
    b: '50,13 56,19 56,45 50,51 44,45 44,19',
    c: '50,49 56,55 56,81 50,87 44,81 44,55',
    d: '13,84 47,84 53,90 47,96 13,96 7,90',
    e: '10,49 16,55 16,81 10,87 4,81 4,55',
    f: '10,13 16,19 16,45 10,51 4,45 4,19',
    g: '13,44 47,44 53,50 47,56 13,56 7,50',
  }
  const ORDER = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const DIGITS: Record<string, string> = {
    '0': 'abcdef',
    '1': 'bc',
    '2': 'abged',
    '3': 'abgcd',
    '4': 'fgbc',
    '5': 'afgcd',
    '6': 'afgedc',
    '7': 'abc',
    '8': 'abcdefg',
    '9': 'abcdfg',
    '-': 'g',
    ' ': '',
  }

  const chars = $derived([...value])
</script>

<span class="seg" style:--c={color} style:height="{height}px" aria-label={ghost ? '' : value}>
  {#each chars as ch, i (i)}
    {#if ch === ':'}
      <svg viewBox="0 0 22 100" aria-hidden="true">
        <circle cx="11" cy="32" r="6" class:on={!ghost} />
        <circle cx="11" cy="68" r="6" class:on={!ghost} />
      </svg>
    {:else if ch === '.'}
      <svg viewBox="0 0 18 100" aria-hidden="true">
        <circle cx="9" cy="89" r="6" class:on={!ghost} />
      </svg>
    {:else}
      {@const lit = ghost ? '' : (DIGITS[ch] ?? '')}
      <svg viewBox="0 0 60 100" aria-hidden="true">
        {#each ORDER as s (s)}
          <polygon points={SEGMENTS[s]} class:on={lit.includes(s)} />
        {/each}
      </svg>
    {/if}
  {/each}
</span>

<style>
  .seg {
    display: inline-flex;
    align-items: stretch;
    gap: 0.07em;
    /* Leggera inclinazione, tipica dei display a segmenti. */
    transform: skewX(-6deg);
    font-size: 0;
  }

  svg {
    height: 100%;
    width: auto;
    overflow: visible;
  }

  polygon,
  circle {
    fill: var(--c);
    opacity: 0.09;
  }

  .on {
    opacity: 1;
    filter: drop-shadow(0 0 6px var(--c)) drop-shadow(0 0 18px var(--c));
  }
</style>
