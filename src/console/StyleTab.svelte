<script lang="ts">
  import { BOARD_STYLES, type BoardStyle } from '../engine'
  import { STYLE_INFO } from '../scoreboard/styles'
  import HelpTip from './HelpTip.svelte'
  import StyleDemo from './StyleDemo.svelte'

  let { current, onchoose }: { current: BoardStyle; onchoose: (style: BoardStyle) => void } =
    $props()
</script>

<div class="style-tab">
  <p class="muted intro">
    Scegli l’aspetto del tabellone sul maxischermo. Il cambio è immediato, anche a partita in corso,
    e resta per le partite successive.
    <HelpTip title="Stile del tabellone">
      Le funzioni sono identiche in tutti gli stili: cambia solo la grafica. Le demo qui sotto
      mostrano a ciclo una fase di gioco con penalità, un gol (alternando le due squadre) e
      l’intervallo.
    </HelpTip>
  </p>

  <div class="grid">
    {#each BOARD_STYLES as id (id)}
      <section class="panel card" class:selected={id === current}>
        <header>
          <h2>{STYLE_INFO[id].name}</h2>
          {#if id === current}<span class="in-use">✓ In uso</span>{/if}
        </header>
        <StyleDemo style={id} />
        <p class="desc">{STYLE_INFO[id].description}</p>
        <button
          type="button"
          class="btn {id === current ? '' : 'btn-primary'}"
          disabled={id === current}
          onclick={() => onchoose(id)}
        >
          {id === current ? 'Stile in uso' : `Usa lo stile ${STYLE_INFO[id].name}`}
        </button>
      </section>
    {/each}
  </div>
</div>

<style>
  .style-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 1400px;
  }

  .intro {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
    gap: 1rem;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-width: 2px;
  }

  .card.selected {
    border-color: var(--ok);
    box-shadow: 0 0 0 1px var(--ok);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .in-use {
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 700;
    color: #06121f;
    background: var(--ok);
  }

  .desc {
    flex: 1;
    margin: 0;
    line-height: 1.45;
    color: #d3e3f5;
  }

  .card .btn {
    align-self: flex-start;
  }
</style>
