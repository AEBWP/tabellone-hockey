<script lang="ts">
  import Modal from './Modal.svelte'
  import { SHORTCUTS } from './shortcuts'
  import { t } from '../i18n/ui.svelte'

  let { open, onclose }: { open: boolean; onclose: () => void } = $props()

  // Passi della guida (in italiano: tradotti al momento di mostrarli).
  const STEPS = [
    '<b>Apri tabellone</b> e spostalo sul maxischermo (doppio clic = schermo intero).',
    'Nella scheda <b>Squadre</b> imposta nomi, sigle, colori e loghi.',
    'All’ingaggio premi <kbd>Spazio</kbd>; a ogni fischio premi di nuovo <kbd>Spazio</kbd>.',
    'Gol: <kbd>C</kbd> (casa) o <kbd>O</kbd> (ospiti). Se la squadra era in superiorità, la penalità minore dell’avversario si chiude da sola.',
    'Penalità: numero di maglia + durata. Il tabellone le conta da solo.',
    'A fine periodo il tempo si ferma da solo e parte l’intervallo; poi il periodo successivo è pronto.',
    'Errore? <kbd>Ctrl</kbd> + <kbd>Z</kbd> annulla l’ultima azione.',
  ]
</script>

<Modal {open} {onclose} title={t('Guida rapida')} wide>
  <div class="grid">
    <section>
      <h3>{t('Scorciatoie da tastiera')}</h3>
      <table>
        <tbody>
          {#each SHORTCUTS as s (s.action)}
            <tr>
              <td class="keys">
                {#each s.keys as k, i (k)}
                  {#if i > 0}+{/if}<kbd>{t(k)}</kbd>
                {/each}
              </td>
              <td>{t(s.description)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="muted">
        {t('Le scorciatoie non funzionano mentre stai scrivendo in un campo di testo.')}
      </p>
    </section>

    <section>
      <h3>{t('Come si usa')}</h3>
      <ol>
        {#each STEPS as step (step)}
          <li>{@html t(step)}</li>
        {/each}
      </ol>
      <p class="muted">
        {@html t(
          'Squadre, loghi e regolamenti si salvano nell’archivio (schede Squadre e Regolamento) e si possono esportare dalla scheda Backup. La partita viene salvata automaticamente: se ricarichi la pagina o il PC si riavvia, riparte da dov’era. Accanto alle funzioni trovi i pulsanti <b>?</b> con spiegazioni più dettagliate.',
        )}
      </p>
    </section>
  </div>
  <p class="muted version">
    {t('Tabellone Hockey versione {version}', { version: __APP_VERSION__ })}
  </p>
</Modal>

<style>
  .version {
    margin: 1.25rem 0 0;
    font-size: 0.8rem;
    text-align: right;
  }

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
