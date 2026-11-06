<script lang="ts">
  import type { Snippet } from 'svelte'
  import { t } from '../i18n/ui.svelte'

  /** Pulsante "?" che apre una breve spiegazione. Si chiude con Esc o cliccando fuori. */
  let {
    title,
    children,
    align = 'left',
  }: { title: string; children: Snippet; align?: 'left' | 'right' } = $props()

  let open = $state(false)
  let root: HTMLSpanElement

  function onWindowClick(e: MouseEvent) {
    if (open && !root.contains(e.target as Node)) open = false
  }

  function onWindowKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape') open = false
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKey} />

<span class="help" bind:this={root}>
  <button
    type="button"
    class="q"
    class:active={open}
    aria-expanded={open}
    aria-label={t('Aiuto: {title}', { title })}
    onclick={() => (open = !open)}
  >
    ?
  </button>
  {#if open}
    <span class="pop" class:right={align === 'right'} role="tooltip">
      <strong>{title}</strong>
      <span class="text">{@render children()}</span>
    </span>
  {/if}
</span>

<style>
  .help {
    position: relative;
    display: inline-flex;
    text-transform: none;
    letter-spacing: normal;
    font-weight: normal;
  }

  .q {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--ice-600);
    border-radius: 50%;
    background: transparent;
    color: var(--ice-300);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .q:hover,
  .q.active {
    background: var(--ice-600);
    color: #fff;
  }

  .pop {
    position: absolute;
    top: calc(100% + 8px);
    left: -12px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 300px;
    padding: 0.8rem 0.95rem;
    border: 1px solid var(--ice-600);
    border-radius: 12px;
    background: #0e2440;
    color: var(--ice-50);
    font-size: 0.9rem;
    line-height: 1.45;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  }

  .pop.right {
    left: auto;
    right: -12px;
  }

  .text {
    color: #d3e3f5;
  }
</style>
