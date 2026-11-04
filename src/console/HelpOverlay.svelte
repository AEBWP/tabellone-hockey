<script lang="ts">
  import Modal from './Modal.svelte'
  import { SHORTCUTS } from './shortcuts'

  let { open, onclose }: { open: boolean; onclose: () => void } = $props()
</script>

<Modal {open} {onclose} title="Guida rapida" wide>
  <div class="grid">
    <section>
      <h3>Scorciatoie da tastiera</h3>
      <table>
        <tbody>
          {#each SHORTCUTS as s (s.action)}
            <tr>
              <td class="keys">
                {#each s.keys as k, i (k)}
                  {#if i > 0}+{/if}<kbd>{k}</kbd>
                {/each}
              </td>
              <td>{s.description}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="muted">Le scorciatoie non funzionano mentre stai scrivendo in un campo di testo.</p>
    </section>

    <section>
      <h3>Come si usa</h3>
      <ol>
        <li><b>Apri tabellone</b> e spostalo sul maxischermo (doppio clic = schermo intero).</li>
        <li>Nella scheda <b>Squadre</b> imposta nomi, sigle, colori e loghi.</li>
        <li>
          All’ingaggio premi <kbd>Spazio</kbd>; a ogni fischio premi di nuovo <kbd>Spazio</kbd>.
        </li>
        <li>
          Gol: <kbd>C</kbd> (casa) o <kbd>O</kbd> (ospiti). Se la squadra era in superiorità, la penalità
          minore dell’avversario si chiude da sola.
        </li>
        <li>Penalità: numero di maglia + durata. Il tabellone le conta da solo.</li>
        <li>
          A fine periodo il tempo si ferma da solo e parte l’intervallo; poi il periodo successivo è
          pronto.
        </li>
        <li>Errore? <kbd>Ctrl</kbd> + <kbd>Z</kbd> annulla l’ultima azione.</li>
      </ol>
      <p class="muted">
        La partita viene salvata automaticamente: se ricarichi la pagina o il PC si riavvia, riparte
        da dov’era. Accanto alle funzioni trovi i pulsanti <b>?</b> con spiegazioni più dettagliate.
      </p>
    </section>
  </div>
</Modal>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  h3 {
    margin: 0 0 0.6rem;
    font-size: 0.85rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ice-300);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  td {
    padding: 0.4rem 0.3rem;
    border-bottom: 1px solid var(--ice-800);
  }

  .keys {
    white-space: nowrap;
  }

  ol {
    margin: 0;
    padding-left: 1.2rem;
    line-height: 1.55;
  }

  li + li {
    margin-top: 0.35rem;
  }

  p {
    font-size: 0.88rem;
  }
</style>
