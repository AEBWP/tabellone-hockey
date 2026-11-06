<script lang="ts">
  import type { Snippet } from 'svelte'
  import { t } from '../i18n/ui.svelte'

  /** Finestra di dialogo (si chiude con Esc o con il pulsante ×). */
  let {
    open,
    title,
    onclose,
    children,
    actions,
    wide = false,
  }: {
    open: boolean
    title: string
    onclose: () => void
    children: Snippet
    actions?: Snippet
    wide?: boolean
  } = $props()

  let dialog: HTMLDialogElement

  $effect(() => {
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  })
</script>

<dialog
  bind:this={dialog}
  class:wide
  onclose={() => open && onclose()}
  onclick={(e) => e.target === dialog && onclose()}
>
  {#if open}
    <header>
      <h2>{title}</h2>
      <button type="button" class="btn btn-ghost btn-sm" onclick={onclose} aria-label={t('Chiudi')}>
        ✕
      </button>
    </header>
    <div class="body">{@render children()}</div>
    {#if actions}
      <footer>{@render actions()}</footer>
    {/if}
  {/if}
</dialog>

<style>
  dialog {
    width: min(92vw, 460px);
    max-height: 88vh;
    padding: 0;
    border: 1px solid var(--ice-800);
    border-radius: 16px;
    background: var(--ice-900);
    color: var(--ice-50);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  }

  dialog.wide {
    width: min(94vw, 820px);
  }

  dialog::backdrop {
    background: rgba(2, 6, 12, 0.7);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem 0.5rem;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  .body {
    padding: 0.5rem 1.25rem 1rem;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding: 0.75rem 1.25rem 1.1rem;
    border-top: 1px solid var(--ice-800);
  }
</style>
