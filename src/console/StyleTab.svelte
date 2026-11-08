<script lang="ts">
  import { BOARD_STYLES, type BoardStyle, type Language } from '../engine'
  import { t } from '../i18n/ui.svelte'
  import { STYLE_INFO } from '../scoreboard/styles'
  import HelpTip from './HelpTip.svelte'
  import StyleDemo from './StyleDemo.svelte'

  let {
    current,
    language,
    onchoose,
  }: {
    current: BoardStyle
    /** Lingua delle scritte sul tabellone, per le demo (si cambia accanto all'anteprima). */
    language: Language
    onchoose: (style: BoardStyle) => void
  } = $props()

  /** Demo in riproduzione: una sola alla volta. */
  let playing = $state<BoardStyle | null>(null)
</script>

<div class="style-tab">
  <p class="muted intro">
    {t(
      'Scegli l’aspetto del tabellone sul maxischermo. Il cambio è immediato, anche a partita in corso, e resta per le partite successive.',
    )}
    <HelpTip title={t('Stile del tabellone')}>
      {t(
        'Le funzioni sono identiche in tutti gli stili: cambia solo la grafica. Premi ▶ per vedere la demo: presentazione delle squadre, inizio partita, gioco, gol e intervallo. Parte una demo alla volta.',
      )}
    </HelpTip>
  </p>

  <div class="grid">
    {#each BOARD_STYLES as id (id)}
      <section class="panel card" class:selected={id === current}>
        <header>
          <h2>{t(STYLE_INFO[id].name)}</h2>
          {#if id === current}<span class="in-use">✓ {t('In uso')}</span>{/if}
        </header>
        <StyleDemo
          style={id}
          {language}
          playing={playing === id}
          onplay={() => (playing = id)}
          onend={() => {
            if (playing === id) playing = null
          }}
        />
        <p class="desc">{t(STYLE_INFO[id].description)}</p>
        <button
          type="button"
          class="btn {id === current ? '' : 'btn-primary'}"
          disabled={id === current}
          onclick={() => onchoose(id)}
        >
          {id === current
            ? t('Stile in uso')
            : t('Usa lo stile {name}', { name: t(STYLE_INFO[id].name) })}
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
    grid-template-columns: repeat(auto-fill, minmax(280px, 360px));
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
